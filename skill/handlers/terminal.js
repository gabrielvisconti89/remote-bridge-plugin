/**
 * Terminal Handler - WebSocket handler for PTY terminal sessions
 *
 * Provides bidirectional terminal streaming over WebSocket.
 */

const ptyManager = require('../utils/ptyManager');
const logger = require('../utils/logger');
const { getState } = require('../utils/state');
const crypto = require('crypto');

/**
 * Setup terminal WebSocket handling
 * @param {WebSocket.Server} wss - WebSocket server instance
 */
function setupTerminalWebSocket(wss) {
  // Track terminal clients separately
  const terminalClients = new Map(); // ws -> { sessionId, clientId }

  // Handle PTY output - broadcast to subscribed clients
  ptyManager.on('output', ({ sessionId, data }) => {
    for (const [ws, clientInfo] of terminalClients.entries()) {
      if (clientInfo.sessionId === sessionId && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({
            type: 'terminal.output',
            sessionId,
            data,
            timestamp: Date.now()
          }));
        } catch (err) {
          logger.error(`Error sending terminal output: ${err.message}`);
        }
      }
    }
  });

  // Handle PTY exit
  ptyManager.on('exit', ({ sessionId, exitCode, signal }) => {
    for (const [ws, clientInfo] of terminalClients.entries()) {
      if (clientInfo.sessionId === sessionId && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({
            type: 'terminal.exit',
            sessionId,
            exitCode,
            signal,
            timestamp: Date.now()
          }));
        } catch (err) {
          logger.error(`Error sending terminal exit: ${err.message}`);
        }
      }
    }
  });

  // Handle mode changes
  ptyManager.on('modeChange', ({ sessionId, mode }) => {
    for (const [ws, clientInfo] of terminalClients.entries()) {
      if (clientInfo.sessionId === sessionId && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({
            type: 'terminal.modeChange',
            sessionId,
            mode,
            timestamp: Date.now()
          }));
        } catch (err) {
          logger.error(`Error sending mode change: ${err.message}`);
        }
      }
    }
  });

  return {
    /**
     * Handle new WebSocket connection for terminal
     * @param {WebSocket} ws
     * @param {object} params - Connection params from query string
     */
    handleConnection(ws, params = {}) {
      const clientId = params.clientId || crypto.randomBytes(8).toString('hex');
      const sessionId = params.sessionId || 'default';
      const cols = parseInt(params.cols) || 120;
      const rows = parseInt(params.rows) || 30;
      const resumeFrom = parseInt(params.resumeFrom) || 0;

      logger.info(`Terminal WebSocket connected: client=${clientId}, session=${sessionId}`);

      // Get or create session
      const session = ptyManager.getOrCreateSession(sessionId, { cols, rows });

      // Subscribe client to session
      ptyManager.subscribeClient(sessionId, ws);

      // Track this client
      terminalClients.set(ws, { sessionId, clientId });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'terminal.connected',
        sessionId,
        clientId,
        session: ptyManager.getSessionInfo(sessionId),
        timestamp: Date.now()
      }));

      // Send buffered output if resuming
      if (resumeFrom > 0) {
        const bufferedOutput = ptyManager.getBufferedOutput(sessionId, resumeFrom);
        if (bufferedOutput) {
          ws.send(JSON.stringify({
            type: 'terminal.buffer',
            sessionId,
            data: bufferedOutput,
            timestamp: Date.now()
          }));
        }
      }

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const msg = JSON.parse(message.toString());
          this.handleMessage(ws, sessionId, msg);
        } catch (err) {
          logger.error(`Error parsing terminal message: ${err.message}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: Date.now()
          }));
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        logger.info(`Terminal WebSocket disconnected: client=${clientId}`);
        ptyManager.unsubscribeClient(sessionId, ws);
        terminalClients.delete(ws);
      });

      // Handle errors
      ws.on('error', (err) => {
        logger.error(`Terminal WebSocket error: ${err.message}`);
        ptyManager.unsubscribeClient(sessionId, ws);
        terminalClients.delete(ws);
      });
    },

    /**
     * Handle incoming terminal message
     * @param {WebSocket} ws
     * @param {string} sessionId
     * @param {object} msg
     */
    handleMessage(ws, sessionId, msg) {
      switch (msg.type) {
        case 'terminal.input':
          // User typed something
          if (msg.data) {
            ptyManager.write(sessionId, msg.data);
          }
          break;

        case 'terminal.resize':
          // Terminal window resized
          if (msg.cols && msg.rows) {
            ptyManager.resize(sessionId, msg.cols, msg.rows);
            ws.send(JSON.stringify({
              type: 'terminal.resized',
              sessionId,
              cols: msg.cols,
              rows: msg.rows,
              timestamp: Date.now()
            }));
          }
          break;

        case 'terminal.key':
          // Special key press
          if (msg.key) {
            const success = ptyManager.sendKey(sessionId, msg.key);
            ws.send(JSON.stringify({
              type: 'terminal.keyAck',
              key: msg.key,
              success,
              timestamp: Date.now()
            }));
          }
          break;

        case 'terminal.toggleMode':
          // Toggle Claude mode (Shift+Tab)
          const success = ptyManager.toggleMode(sessionId);
          ws.send(JSON.stringify({
            type: 'terminal.modeToggled',
            success,
            timestamp: Date.now()
          }));
          break;

        case 'terminal.ping':
          // Heartbeat
          ws.send(JSON.stringify({
            type: 'terminal.pong',
            timestamp: Date.now()
          }));
          break;

        case 'terminal.getSession':
          // Get session info
          const info = ptyManager.getSessionInfo(sessionId);
          ws.send(JSON.stringify({
            type: 'terminal.sessionInfo',
            session: info,
            timestamp: Date.now()
          }));
          break;

        case 'terminal.getBuffer':
          // Get buffered output
          const sinceTimestamp = msg.since || 0;
          const buffer = ptyManager.getBufferedOutput(sessionId, sinceTimestamp);
          ws.send(JSON.stringify({
            type: 'terminal.buffer',
            sessionId,
            data: buffer,
            since: sinceTimestamp,
            timestamp: Date.now()
          }));
          break;

        default:
          logger.warn(`Unknown terminal message type: ${msg.type}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${msg.type}`,
            timestamp: Date.now()
          }));
      }
    },

    /**
     * Get active terminal clients count
     */
    getClientCount() {
      return terminalClients.size;
    },

    /**
     * Broadcast to all terminal clients
     * @param {object} message
     */
    broadcast(message) {
      const payload = JSON.stringify({
        ...message,
        timestamp: Date.now()
      });

      for (const [ws] of terminalClients.entries()) {
        if (ws.readyState === 1) {
          try {
            ws.send(payload);
          } catch (err) {
            logger.error(`Error broadcasting: ${err.message}`);
          }
        }
      }
    }
  };
}

/**
 * HTTP endpoints for terminal management
 */
function createTerminalRouter() {
  const express = require('express');
  const router = express.Router();

  // List all sessions
  router.get('/sessions', (req, res) => {
    const sessions = ptyManager.listSessions();
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  });

  // Get specific session info
  router.get('/sessions/:sessionId', (req, res) => {
    const session = ptyManager.getSessionInfo(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    res.json({
      success: true,
      session
    });
  });

  // Kill a session
  router.delete('/sessions/:sessionId', (req, res) => {
    const success = ptyManager.killSession(req.params.sessionId);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    res.json({
      success: true,
      message: 'Session killed'
    });
  });

  // Get current mode
  router.get('/mode', (req, res) => {
    const state = getState();
    res.json({
      success: true,
      modes: state.modes || { plan: false, autoAccept: false }
    });
  });

  // Toggle mode (sends Shift+Tab to default session)
  router.post('/mode/toggle', (req, res) => {
    const sessionId = req.body.sessionId || 'default';
    const success = ptyManager.toggleMode(sessionId);
    res.json({
      success,
      message: success ? 'Mode toggle sent' : 'Session not found'
    });
  });

  return router;
}

module.exports = {
  setupTerminalWebSocket,
  createTerminalRouter
};
