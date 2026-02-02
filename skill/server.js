const http = require('http');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const localtunnel = require('localtunnel');

const config = require('./utils/config');
const logger = require('./utils/logger');
const state = require('./utils/state');
const { OutputWatcher } = require('./utils/outputWatcher');

// Validate configuration
try {
  config.validate();
} catch (err) {
  logger.error('Configuration error', { error: err.message });
  process.exit(1);
}

// Auto-generate API key if not set
if (!config.apiKey) {
  config.apiKey = crypto.randomBytes(16).toString('hex');
}

// Express app
const app = express();

// Middleware: CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Middleware: JSON body parser
app.use(express.json({ limit: '10mb' }));

// Middleware: HTTP logging
app.use(logger.httpLogger());

// Middleware: API Key authentication (optional)
if (config.apiKey) {
  app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== config.apiKey) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
    }
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Status broadcast endpoint - Claude can call this to send status to app
app.post('/status', (req, res) => {
  const { message, type = 'thinking' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Broadcast to all connected clients
  const statusMessage = JSON.stringify({
    type: 'claude.status',
    message,
    statusType: type,
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  clients.forEach((client) => {
    if (client.ws.readyState === 1) {
      client.ws.send(statusMessage);
      sent++;
      // Track sent message
      state.incrementSent();
    }
  });

  console.log(`✽ [Claude Status] ${message}`);

  res.json({ success: true, sent });
});

// Clear status endpoint - Claude can call this to clear status from app
app.delete('/status', (req, res) => {
  const statusMessage = JSON.stringify({
    type: 'claude.status.clear',
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  clients.forEach((client) => {
    if (client.ws.readyState === 1) {
      client.ws.send(statusMessage);
      sent++;
    }
  });

  res.json({ success: true, sent });
});

// Claude activity endpoint - receives tool usage from PostToolUse hook
app.post('/claude/activity', (req, res) => {
  const { type, tool, command, path, result, timestamp } = req.body;

  // Build activity message
  let activityText = `[${tool}]`;
  if (command) {
    activityText += ` ${command}`;
  } else if (path) {
    activityText += ` ${path}`;
  }

  // Broadcast to all connected clients
  const activityMessage = JSON.stringify({
    type: 'claude.activity',
    tool,
    command,
    path,
    result,
    text: activityText,
    timestamp: timestamp || new Date().toISOString(),
  });

  let sent = 0;
  clients.forEach((client) => {
    if (client.ws.readyState === 1) {
      client.ws.send(activityMessage);
      sent++;
      state.incrementSent();
    }
  });

  console.log(`✽ [Claude Activity] ${activityText}`);

  res.json({ success: true, sent });
});

// Output log clear endpoint - clears the output log file
app.delete('/claude/output', (req, res) => {
  // Import will happen after outputWatcher is created, so use late binding
  const { OUTPUT_FILE } = require('./utils/outputWatcher');
  const fs = require('fs');

  try {
    fs.writeFileSync(OUTPUT_FILE, '');
    res.json({ success: true, message: 'Output log cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear output log', message: err.message });
  }
});

// Register handlers
const handlers = require('./handlers');
handlers.register(app);

// Middleware: 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Middleware: Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// HTTP Server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });

// Connected clients map
const clients = new Map();
let clientIdCounter = 0;

// WebSocket: Connection handler
wss.on('connection', (ws, req) => {
  // Validate API key from query parameter
  const url = new URL(req.url, 'http://localhost');
  if (config.apiKey) {
    const key = url.searchParams.get('key');

    if (key !== config.apiKey) {
      ws.close(4001, 'Unauthorized');
      logger.warn('WebSocket connection rejected: invalid key');
      return;
    }
  }

  // Get device name from query parameter (sent by mobile app)
  const deviceName = url.searchParams.get('device') || 'Unknown Device';

  const clientId = ++clientIdCounter;
  const clientIp = req.socket.remoteAddress;

  clients.set(clientId, {
    ws,
    ip: clientIp,
    deviceName,
    connectedAt: new Date(),
    isAlive: true,
  });

  logger.info('WebSocket client connected', { clientId, ip: clientIp, deviceName, total: clients.size });

  // Update state: mark as connected with device info
  state.updateState({
    connected: true,
    connectedDevice: deviceName,
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: 'Welcome to Remote Bridge',
    timestamp: new Date().toISOString(),
  }));

  // Count this as a received message (connection)
  state.incrementReceived();

  // Pong handler for heartbeat
  ws.on('pong', () => {
    const client = clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  });

  // Message handler
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      logger.debug('WebSocket message received', { clientId, type: message.type });

      // Track received message
      state.incrementReceived();

      handleWebSocketMessage(clientId, ws, message);
    } catch (err) {
      logger.warn('Invalid WebSocket message', { clientId, error: err.message });
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format. Expected JSON.',
      }));
    }
  });

  // Close handler
  ws.on('close', (code, reason) => {
    clients.delete(clientId);
    logger.info('WebSocket client disconnected', {
      clientId,
      code,
      reason: reason.toString(),
      total: clients.size,
    });

    // Update state: if no more clients, mark as disconnected
    if (clients.size === 0) {
      state.updateState({
        connected: false,
        connectedDevice: null,
      });
    }
  });

  // Error handler
  ws.on('error', (err) => {
    logger.error('WebSocket error', { clientId, error: err.message });
  });
});

/**
 * Handle WebSocket messages
 * @param {number} clientId - Client ID
 * @param {WebSocket} ws - WebSocket instance
 * @param {object} message - Parsed message
 */
function handleWebSocketMessage(clientId, ws, message) {
  const { type, action, payload } = message;

  switch (type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    case 'command':
      // Commands will be handled in Phase 3
      ws.send(JSON.stringify({
        type: 'response',
        action,
        success: false,
        message: 'Commands not yet implemented',
      }));
      break;

    case 'broadcast':
      // Broadcast to all other clients
      broadcastMessage(clientId, payload);
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${type}`,
      }));
  }
}

/**
 * Broadcast message to all connected clients except sender
 * @param {number} senderId - Sender client ID
 * @param {object} payload - Message payload
 */
function broadcastMessage(senderId, payload) {
  const message = JSON.stringify({
    type: 'broadcast',
    from: senderId,
    payload,
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  clients.forEach((client, clientId) => {
    if (clientId !== senderId && client.ws.readyState === 1) {
      client.ws.send(message);
      sent++;
      // Track sent message
      state.incrementSent();
    }
  });

  logger.debug('Broadcast sent', { from: senderId, recipients: sent });
}

// Heartbeat interval - ping all clients
const heartbeatInterval = setInterval(() => {
  clients.forEach((client, clientId) => {
    if (!client.isAlive) {
      logger.info('Terminating inactive client', { clientId });
      client.ws.terminate();
      clients.delete(clientId);
      return;
    }

    client.isAlive = false;
    client.ws.ping();
  });
}, config.wsHeartbeatInterval);

// Output watcher - monitors Claude Code terminal output
const outputWatcher = new OutputWatcher();
outputWatcher.start();

outputWatcher.on('output', (line) => {
  // Skip empty lines after cleaning
  if (!line || line.trim().length === 0) {
    return;
  }

  // Broadcast to all connected clients
  const message = JSON.stringify({
    type: 'claude.output',
    content: line,
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  clients.forEach((client) => {
    if (client.ws.readyState === 1) {
      client.ws.send(message);
      sent++;
      state.incrementSent();
    }
  });

  if (sent > 0) {
    logger.debug('Output broadcast', { line: line.substring(0, 100), recipients: sent });
  }
});

outputWatcher.on('error', (err) => {
  logger.error('Output watcher error', { error: err.message });
});

// Cleanup on server close
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Start server
server.listen(config.port, config.host, async () => {
  logger.info('Server started', {
    host: config.host,
    port: config.port,
    environment: process.env.NODE_ENV || 'development',
  });

  // Reset metrics on server start
  state.resetMetrics();

  // Create localtunnel for public access
  let tunnel = null;
  let publicUrl = null;
  try {
    tunnel = await localtunnel({ port: config.port });
    publicUrl = tunnel.url;

    // Display connection info
    console.log('');
    console.log('============================================================');
    console.log('           REMOTE BRIDGE - Connection Info                  ');
    console.log('============================================================');
    console.log(`  Public URL:  ${tunnel.url}`);
    console.log(`  API Key:     ${config.apiKey}`);
    console.log(`  Local:       http://localhost:${config.port}`);
    console.log('============================================================');
    console.log('');

    // Handle tunnel close
    tunnel.on('close', () => {
      logger.warn('Tunnel closed');
    });

    tunnel.on('error', (err) => {
      logger.error('Tunnel error', { error: err.message });
    });
  } catch (err) {
    logger.error('Failed to create tunnel', { error: err.message });
    publicUrl = `http://localhost:${config.port}`;
    console.log('');
    console.log('============================================================');
    console.log('           REMOTE BRIDGE - Local Only                       ');
    console.log('============================================================');
    console.log(`  Local:       http://localhost:${config.port}`);
    console.log(`  API Key:     ${config.apiKey}`);
    console.log('  (Tunnel failed - local access only)');
    console.log('============================================================');
    console.log('');
  }

  // Save state with connection info
  state.updateState({
    enabled: true,
    pid: process.pid,
    url: publicUrl,
    apiKey: config.apiKey,
    connected: false,
    connectedDevice: null,
    startedAt: new Date().toISOString(),
  });

  logger.info(`HTTP: http://${config.host}:${config.port}`);
  logger.info(`WebSocket: ws://${config.host}:${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop output watcher
  outputWatcher.stop();

  // Clear state
  state.clearState();

  // Close WebSocket connections
  clients.forEach((client) => {
    client.ws.close(1001, 'Server shutting down');
  });

  // Close HTTP server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    logger.warn('Forcing shutdown');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  process.emit('SIGTERM');
});

module.exports = { app, server, wss, clients, broadcastMessage, outputWatcher };
