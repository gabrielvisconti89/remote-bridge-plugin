/**
 * PTY Manager - Manages pseudo-terminal sessions for Claude CLI
 *
 * Provides real terminal experience by spawning Claude in a PTY
 * and streaming I/O bidirectionally over WebSocket.
 */

const pty = require('node-pty');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { readState, updateState } = require('./state');
const logger = require('./logger');

class PtyManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // sessionId -> { pty, buffer, clients }
    this.outputBuffer = new Map(); // sessionId -> Array of output chunks
    this.maxBufferSize = 100000; // Max characters to buffer for reconnection
  }

  /**
   * Create or get existing PTY session
   * @param {string} sessionId - Unique session identifier
   * @param {object} options - PTY options (cols, rows, cwd)
   * @returns {object} Session info
   */
  getOrCreateSession(sessionId, options = {}) {
    if (this.sessions.has(sessionId)) {
      logger.info(`Resuming existing PTY session: ${sessionId}`);
      return this.sessions.get(sessionId);
    }

    const {
      cols = 120,
      rows = 30,
      cwd = process.env.HOME || os.homedir()
    } = options;

    // Determine shell and Claude command
    const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
    const shellArgs = os.platform() === 'win32' ? [] : ['-l']; // Login shell for proper env

    logger.info(`Creating new PTY session: ${sessionId} (${cols}x${rows})`);

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: 'en_US.UTF-8',
        // Ensure Claude CLI is in PATH
        PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`
      }
    });

    const session = {
      id: sessionId,
      pty: ptyProcess,
      pid: ptyProcess.pid,
      clients: new Set(), // WebSocket clients subscribed to this session
      buffer: '',
      createdAt: new Date(),
      lastActivity: new Date(),
      cols,
      rows,
      claudeStarted: false
    };

    // Initialize output buffer
    this.outputBuffer.set(sessionId, []);

    // Handle PTY output
    ptyProcess.onData((data) => {
      session.lastActivity = new Date();

      // Add to buffer for reconnection
      this.addToBuffer(sessionId, data);

      // Emit for WebSocket broadcast
      this.emit('output', { sessionId, data });

      // Detect if Claude has started
      if (!session.claudeStarted && data.includes('claude')) {
        session.claudeStarted = true;
        logger.info(`Claude CLI detected in session ${sessionId}`);
      }

      // Detect mode changes
      this.detectModeChange(sessionId, data);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      logger.info(`PTY session ${sessionId} exited: code=${exitCode}, signal=${signal}`);
      this.emit('exit', { sessionId, exitCode, signal });
      this.sessions.delete(sessionId);
      this.outputBuffer.delete(sessionId);
    });

    this.sessions.set(sessionId, session);

    // Auto-start Claude CLI after shell is ready
    setTimeout(() => {
      this.startClaude(sessionId);
    }, 500);

    return session;
  }

  /**
   * Start Claude CLI in the session
   * @param {string} sessionId
   */
  startClaude(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info(`Starting Claude CLI in session ${sessionId}`);

    // Start Claude CLI
    session.pty.write('claude\r');
  }

  /**
   * Write data to PTY (user input)
   * @param {string} sessionId
   * @param {string} data - Input data (keystrokes)
   */
  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Cannot write to non-existent session: ${sessionId}`);
      return false;
    }

    session.lastActivity = new Date();
    session.pty.write(data);
    return true;
  }

  /**
   * Resize PTY
   * @param {string} sessionId
   * @param {number} cols
   * @param {number} rows
   */
  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    logger.debug(`Resizing session ${sessionId} to ${cols}x${rows}`);
    session.pty.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
    return true;
  }

  /**
   * Send special key sequences
   * @param {string} sessionId
   * @param {string} key - Special key name
   */
  sendKey(sessionId, key) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const keySequences = {
      'enter': '\r',
      'tab': '\t',
      'escape': '\x1b',
      'backspace': '\x7f',
      'delete': '\x1b[3~',
      'up': '\x1b[A',
      'down': '\x1b[B',
      'right': '\x1b[C',
      'left': '\x1b[D',
      'home': '\x1b[H',
      'end': '\x1b[F',
      'pageup': '\x1b[5~',
      'pagedown': '\x1b[6~',
      'ctrl+c': '\x03',
      'ctrl+d': '\x04',
      'ctrl+z': '\x1a',
      'ctrl+l': '\x0c',
      'shift+tab': '\x1b[Z', // For mode toggle in Claude
    };

    const sequence = keySequences[key.toLowerCase()];
    if (sequence) {
      session.pty.write(sequence);
      logger.debug(`Sent key '${key}' to session ${sessionId}`);
      return true;
    }

    logger.warn(`Unknown key: ${key}`);
    return false;
  }

  /**
   * Toggle Claude mode (sends Shift+Tab)
   * @param {string} sessionId
   */
  toggleMode(sessionId) {
    return this.sendKey(sessionId, 'shift+tab');
  }

  /**
   * Add data to reconnection buffer
   * @param {string} sessionId
   * @param {string} data
   */
  addToBuffer(sessionId, data) {
    const buffer = this.outputBuffer.get(sessionId);
    if (!buffer) return;

    buffer.push({
      data,
      timestamp: Date.now()
    });

    // Calculate total size
    let totalSize = buffer.reduce((sum, chunk) => sum + chunk.data.length, 0);

    // Trim old data if buffer exceeds max size
    while (totalSize > this.maxBufferSize && buffer.length > 0) {
      const removed = buffer.shift();
      totalSize -= removed.data.length;
    }
  }

  /**
   * Get buffered output for reconnection
   * @param {string} sessionId
   * @param {number} sinceTimestamp - Get output since this timestamp
   * @returns {string} Buffered output
   */
  getBufferedOutput(sessionId, sinceTimestamp = 0) {
    const buffer = this.outputBuffer.get(sessionId);
    if (!buffer) return '';

    return buffer
      .filter(chunk => chunk.timestamp > sinceTimestamp)
      .map(chunk => chunk.data)
      .join('');
  }

  /**
   * Detect mode changes from terminal output
   * @param {string} sessionId
   * @param {string} data
   */
  detectModeChange(sessionId, data) {
    // Look for mode indicators in Claude output
    const planModePattern = /plan mode|planning mode|\[plan\]/i;
    const normalModePattern = /normal mode|execution mode|\[normal\]/i;
    const autoAcceptPattern = /auto.?accept|auto mode|\[auto\]/i;

    let detectedMode = null;

    if (planModePattern.test(data)) {
      detectedMode = 'plan';
    } else if (autoAcceptPattern.test(data)) {
      detectedMode = 'autoAccept';
    } else if (normalModePattern.test(data)) {
      detectedMode = 'normal';
    }

    if (detectedMode) {
      const currentState = readState();
      if (currentState.modes && currentState.modes[detectedMode] !== true) {
        // Update state
        const modes = { plan: false, autoAccept: false };
        if (detectedMode === 'plan') modes.plan = true;
        if (detectedMode === 'autoAccept') modes.autoAccept = true;
        updateState({ modes });

        this.emit('modeChange', { sessionId, mode: detectedMode });
        logger.info(`Mode changed to: ${detectedMode}`);
      }
    }
  }

  /**
   * Get session info
   * @param {string} sessionId
   * @returns {object|null} Session info without PTY handle
   */
  getSessionInfo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      pid: session.pid,
      cols: session.cols,
      rows: session.rows,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      claudeStarted: session.claudeStarted,
      clientCount: session.clients.size,
      bufferSize: this.outputBuffer.get(sessionId)?.length || 0
    };
  }

  /**
   * List all active sessions
   * @returns {Array} Session info list
   */
  listSessions() {
    return Array.from(this.sessions.keys()).map(id => this.getSessionInfo(id));
  }

  /**
   * Subscribe a WebSocket client to a session
   * @param {string} sessionId
   * @param {WebSocket} client
   */
  subscribeClient(sessionId, client) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clients.add(client);
      logger.debug(`Client subscribed to session ${sessionId}`);
    }
  }

  /**
   * Unsubscribe a WebSocket client from a session
   * @param {string} sessionId
   * @param {WebSocket} client
   */
  unsubscribeClient(sessionId, client) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clients.delete(client);
      logger.debug(`Client unsubscribed from session ${sessionId}`);
    }
  }

  /**
   * Kill a session
   * @param {string} sessionId
   */
  killSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    logger.info(`Killing session ${sessionId}`);
    session.pty.kill();
    this.sessions.delete(sessionId);
    this.outputBuffer.delete(sessionId);
    return true;
  }

  /**
   * Kill all sessions (cleanup)
   */
  killAll() {
    logger.info(`Killing all PTY sessions (${this.sessions.size} active)`);
    for (const sessionId of this.sessions.keys()) {
      this.killSession(sessionId);
    }
  }
}

// Singleton instance
const ptyManager = new PtyManager();

// Cleanup on process exit
process.on('exit', () => ptyManager.killAll());
process.on('SIGINT', () => {
  ptyManager.killAll();
  process.exit();
});
process.on('SIGTERM', () => {
  ptyManager.killAll();
  process.exit();
});

module.exports = ptyManager;
