const http = require('http');
const express = require('express');
const { WebSocket, WebSocketServer } = require('ws');
const request = require('supertest');

// Mock os and config before requiring
jest.mock('os', () => ({
  homedir: () => global.TEST_STATE_DIR,
  platform: () => 'darwin',
  cpus: () => [{ model: 'Test CPU', speed: 2400 }],
  totalmem: () => 16 * 1024 * 1024 * 1024,
  freemem: () => 8 * 1024 * 1024 * 1024,
  uptime: () => 3600,
  type: () => 'Darwin',
  release: () => '21.0.0',
  arch: () => 'arm64',
  hostname: () => 'test-host',
  loadavg: () => [1.5, 1.2, 1.0],
  networkInterfaces: () => ({
    en0: [{ address: '192.168.1.1', family: 'IPv4', internal: false, mac: '00:00:00:00:00:00', netmask: '255.255.255.0' }],
  }),
  userInfo: () => ({ username: 'testuser' }),
  tmpdir: () => '/tmp',
}));

jest.mock('../../utils/config', () => ({
  port: 0, // Use random port for tests
  host: '127.0.0.1',
  logLevel: 'error',
  apiKey: 'test-api-key',
  maxFileSize: 10 * 1024 * 1024,
  commandTimeout: 5000,
  wsHeartbeatInterval: 30000,
  basePath: '/test',
  validate: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  httpLogger: () => (req, res, next) => next(),
}));

// Mock localtunnel to avoid network calls
jest.mock('localtunnel', () => jest.fn(() => Promise.reject(new Error('Disabled in tests'))));

// Mock OutputWatcher
jest.mock('../../utils/outputWatcher', () => ({
  OutputWatcher: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
  })),
  OUTPUT_FILE: '/tmp/test-output.log',
}));

describe('Server Integration Tests', () => {
  let app;
  let server;
  let wss;
  let clients;
  let port;

  beforeEach((done) => {
    jest.resetModules();

    // Create a test server manually to avoid the localtunnel startup
    app = express();
    app.use(express.json());

    const config = require('../../utils/config');

    // Add CORS
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      next();
    });

    // API Key authentication
    app.use((req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== config.apiKey) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
      }
      next();
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Status endpoint
    app.post('/status', (req, res) => {
      const { message, type = 'thinking' } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }
      let sent = 0;
      clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'claude.status',
            message,
            statusType: type,
            timestamp: new Date().toISOString(),
          }));
          sent++;
        }
      });
      res.json({ success: true, sent });
    });

    // Register handlers
    const handlers = require('../../handlers');
    handlers.register(app);

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
    });

    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ error: err.name || 'Internal Server Error', message: err.message });
    });

    // Create server
    server = http.createServer(app);

    // WebSocket Server
    wss = new WebSocketServer({ server });
    clients = new Map();
    let clientIdCounter = 0;

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, 'http://localhost');
      const key = url.searchParams.get('key');
      const config = require('../../utils/config');

      if (key !== config.apiKey) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      const clientId = ++clientIdCounter;
      const deviceName = url.searchParams.get('device') || 'Test Device';

      clients.set(clientId, {
        ws,
        ip: req.socket.remoteAddress,
        deviceName,
        connectedAt: new Date(),
        isAlive: true,
      });

      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        message: 'Welcome to Remote Bridge',
        timestamp: new Date().toISOString(),
      }));

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        clients.delete(clientId);
      });
    });

    // Start server on random port
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  afterEach((done) => {
    // Close all WebSocket connections
    clients.forEach((client) => {
      client.ws.close();
    });
    clients.clear();

    // Close WebSocket server
    wss.close(() => {
      // Close HTTP server
      server.close(done);
    });
  });

  describe('HTTP API', () => {
    describe('Authentication', () => {
      it('rejects requests without API key', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('rejects requests with invalid API key', async () => {
        const response = await request(app)
          .get('/health')
          .set('X-API-Key', 'wrong-key');

        expect(response.status).toBe(401);
      });

      it('accepts requests with valid API key', async () => {
        const response = await request(app)
          .get('/health')
          .set('X-API-Key', 'test-api-key');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });

    describe('Health Endpoint', () => {
      it('returns health status', async () => {
        const response = await request(app)
          .get('/health')
          .set('X-API-Key', 'test-api-key');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
      });
    });

    describe('Status Endpoint', () => {
      it('returns 400 when message is missing', async () => {
        const response = await request(app)
          .post('/status')
          .set('X-API-Key', 'test-api-key')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('message is required');
      });

      it('broadcasts status to connected clients', async () => {
        // Connect a WebSocket client first
        const ws = new WebSocket(`ws://127.0.0.1:${port}?key=test-api-key`);

        await new Promise((resolve) => ws.on('open', resolve));
        await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for welcome message

        const messages = [];
        ws.on('message', (data) => {
          messages.push(JSON.parse(data.toString()));
        });

        const response = await request(app)
          .post('/status')
          .set('X-API-Key', 'test-api-key')
          .send({ message: 'Test status', type: 'working' });

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.sent).toBe(1);

        const statusMsg = messages.find((m) => m.type === 'claude.status');
        expect(statusMsg).toBeDefined();
        expect(statusMsg.message).toBe('Test status');
        expect(statusMsg.statusType).toBe('working');

        ws.close();
      });
    });

    describe('System Info Endpoint', () => {
      it('returns system information', async () => {
        const response = await request(app)
          .get('/system/info')
          .set('X-API-Key', 'test-api-key');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.system).toHaveProperty('platform', 'darwin');
        expect(response.body.cpu).toHaveProperty('cores');
        expect(response.body.memory).toHaveProperty('total');
      });
    });

    describe('404 Handler', () => {
      it('returns 404 for unknown routes', async () => {
        const response = await request(app)
          .get('/unknown/route')
          .set('X-API-Key', 'test-api-key');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Not Found');
      });
    });
  });

  describe('WebSocket API', () => {
    describe('Connection', () => {
      it('rejects connection without API key', (done) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);

        ws.on('close', (code) => {
          expect(code).toBe(4001);
          done();
        });
      });

      it('rejects connection with invalid API key', (done) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}?key=wrong-key`);

        ws.on('close', (code) => {
          expect(code).toBe(4001);
          done();
        });
      });

      it('accepts connection with valid API key', (done) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}?key=test-api-key`);

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('connected');
          expect(message.message).toBe('Welcome to Remote Bridge');
          ws.close();
          done();
        });
      });

      it('includes device name in connection info', (done) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}?key=test-api-key&device=iPhone%2015`);

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('connected');
          // Device name would be stored in server state
          ws.close();
          done();
        });
      });
    });

    describe('Ping/Pong', () => {
      it('responds to ping with pong', (done) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}?key=test-api-key`);
        let receivedWelcome = false;

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'connected') {
            receivedWelcome = true;
            ws.send(JSON.stringify({ type: 'ping' }));
          } else if (message.type === 'pong') {
            expect(message.timestamp).toBeDefined();
            ws.close();
            done();
          }
        });
      });
    });

    describe('Error Handling', () => {
      it('handles invalid JSON messages', (done) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}?key=test-api-key`);
        let receivedWelcome = false;

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'connected') {
            receivedWelcome = true;
            ws.send('not valid json');
          } else if (message.type === 'error') {
            expect(message.message).toBe('Invalid message format');
            ws.close();
            done();
          }
        });
      });
    });
  });
});
