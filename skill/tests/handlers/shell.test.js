// Mock os module before requiring - include all methods used by dependencies
jest.mock('os', () => {
  const actualOs = jest.requireActual('os');
  return {
    ...actualOs,
    homedir: () => global.TEST_STATE_DIR,
    platform: () => 'darwin',
  };
});

// Create mock spawn with tracked calls
const mockSpawn = jest.fn();

// Mock child_process
jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
  execSync: jest.fn(),
}));

// Mock server (to avoid starting real server)
jest.mock('../../server', () => ({
  clients: new Map(),
}));

// Create a mock config that doesn't use dotenv
jest.mock('../../utils/config', () => ({
  port: 3000,
  host: '0.0.0.0',
  logLevel: 'error',
  apiKey: null,
  maxFileSize: 10 * 1024 * 1024,
  commandTimeout: 30000,
  wsHeartbeatInterval: 30000,
  basePath: '/test',
  validate: jest.fn().mockReturnValue(true),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  httpLogger: () => (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');

let app;
let commandQueue;

beforeEach(() => {
  jest.clearAllMocks();

  // Create fresh app and handler
  app = express();
  app.use(express.json());

  // Reset modules to get fresh state for commandQueue
  jest.resetModules();

  // Re-mock os after reset
  jest.doMock('os', () => {
    const actualOs = jest.requireActual('os');
    return {
      ...actualOs,
      homedir: () => global.TEST_STATE_DIR,
      platform: () => 'darwin',
    };
  });

  commandQueue = require('../../utils/commandQueue');
  commandQueue.clearAll();

  const shellHandler = require('../../handlers/shell');
  app.use('/shell', shellHandler);
});

/**
 * Create a mock child process
 */
function createMockChild(options = {}) {
  const {
    stdout = '',
    stderr = '',
    exitCode = 0,
    exitSignal = null,
    pid = 12345,
    shouldError = false,
    errorMessage = 'spawn error',
  } = options;

  const child = {
    pid,
    stdout: {
      on: jest.fn((event, cb) => {
        if (event === 'data' && stdout) {
          setImmediate(() => cb(Buffer.from(stdout)));
        }
      }),
    },
    stderr: {
      on: jest.fn((event, cb) => {
        if (event === 'data' && stderr) {
          setImmediate(() => cb(Buffer.from(stderr)));
        }
      }),
    },
    on: jest.fn((event, cb) => {
      if (event === 'close' && !shouldError) {
        setImmediate(() => cb(exitCode, exitSignal));
      }
      if (event === 'error' && shouldError) {
        setImmediate(() => cb(new Error(errorMessage)));
      }
    }),
    kill: jest.fn(),
  };

  return child;
}

describe('shell handler', () => {
  describe('POST /shell/exec', () => {
    it('returns 400 when command is missing', async () => {
      const response = await request(app).post('/shell/exec').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Command is required');
    });

    it('executes command and returns result', async () => {
      const mockChild = createMockChild({
        stdout: 'test output',
        exitCode: 0,
      });
      mockSpawn.mockReturnValue(mockChild);

      const response = await request(app)
        .post('/shell/exec')
        .send({ command: 'echo test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.command).toBe('echo test');
      expect(response.body.code).toBe(0);
      expect(response.body.stdout).toBe('test output');
      expect(mockSpawn).toHaveBeenCalledWith('echo test', [], expect.any(Object));
    });

    it('returns error result when command fails', async () => {
      const mockChild = createMockChild({
        stderr: 'error message',
        exitCode: 1,
      });
      mockSpawn.mockReturnValue(mockChild);

      const response = await request(app)
        .post('/shell/exec')
        .send({ command: 'invalid-command' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(1);
    });

    it('uses custom cwd and timeout', async () => {
      const mockChild = createMockChild({ exitCode: 0 });
      mockSpawn.mockReturnValue(mockChild);

      await request(app).post('/shell/exec').send({
        command: 'ls',
        cwd: '/tmp',
        timeout: 5000,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'ls',
        [],
        expect.objectContaining({
          cwd: '/tmp',
          timeout: 5000,
        })
      );
    });
  });

  describe('GET /shell/processes', () => {
    it('returns empty list when no processes running', async () => {
      const response = await request(app).get('/shell/processes');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.processes).toEqual([]);
    });
  });

  describe('POST /shell/type', () => {
    it('returns 400 when command is missing', async () => {
      const response = await request(app).post('/shell/type').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Command is required');
    });

    it('queues command successfully', async () => {
      const response = await request(app).post('/shell/type').send({
        command: 'npm test',
        deviceName: 'Test Phone',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.queued).toBe(true);
      expect(response.body.command).toBe('npm test');
      expect(response.body.from).toBe('Test Phone');
      expect(response.body.id).toMatch(/^cmd_[a-f0-9]{12}$/);
    });

    it('uses default device name', async () => {
      const response = await request(app).post('/shell/type').send({
        command: 'npm test',
      });

      expect(response.status).toBe(200);
      expect(response.body.from).toBe('Mobile App');
    });
  });

  describe('GET /shell/queue', () => {
    it('returns empty queue', async () => {
      const response = await request(app).get('/shell/queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.commands).toEqual([]);
    });

    it('returns pending commands only by default', async () => {
      const cmd1 = commandQueue.addCommand('command1');
      const cmd2 = commandQueue.addCommand('command2');
      commandQueue.updateCommandStatus(cmd1.id, 'executed');

      const response = await request(app).get('/shell/queue');

      expect(response.body.count).toBe(1);
      expect(response.body.commands[0].id).toBe(cmd2.id);
    });

    it('returns all commands when all=true', async () => {
      const cmd1 = commandQueue.addCommand('command1');
      commandQueue.addCommand('command2');
      commandQueue.updateCommandStatus(cmd1.id, 'executed');

      const response = await request(app).get('/shell/queue?all=true');

      expect(response.body.count).toBe(2);
    });
  });

  describe('DELETE /shell/queue/:id', () => {
    it('removes command from queue', async () => {
      const cmd = commandQueue.addCommand('test command');

      const response = await request(app).delete(`/shell/queue/${cmd.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(commandQueue.getCommand(cmd.id)).toBeNull();
    });

    it('returns 404 for non-existent command', async () => {
      const response = await request(app).delete('/shell/queue/cmd_nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('DELETE /shell/queue', () => {
    it('clears all commands from queue', async () => {
      commandQueue.addCommand('command1');
      commandQueue.addCommand('command2');

      const response = await request(app).delete('/shell/queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(commandQueue.getAllCommands()).toHaveLength(0);
    });
  });

  describe('POST /shell/queue/:id/execute', () => {
    it('returns 404 for non-existent command', async () => {
      const response = await request(app).post('/shell/queue/cmd_nonexistent/execute');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });

    it('returns 400 for already executed command', async () => {
      const cmd = commandQueue.addCommand('test');
      commandQueue.updateCommandStatus(cmd.id, 'executed');

      const response = await request(app).post(`/shell/queue/${cmd.id}/execute`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('already been executed');
    });

    it('executes pending command', async () => {
      const mockChild = createMockChild({
        stdout: 'hello',
        exitCode: 0,
      });
      mockSpawn.mockReturnValue(mockChild);

      const cmd = commandQueue.addCommand('echo hello', 'Test Device');

      const response = await request(app).post(`/shell/queue/${cmd.id}/execute`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.queueId).toBe(cmd.id);
      expect(response.body.from).toBe('Test Device');
    });
  });

  describe('POST /shell/queue/:id/dismiss', () => {
    it('dismisses pending command', async () => {
      const cmd = commandQueue.addCommand('test');

      const response = await request(app).post(`/shell/queue/${cmd.id}/dismiss`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe(cmd.id);

      const updated = commandQueue.getCommand(cmd.id);
      expect(updated.status).toBe('dismissed');
    });

    it('returns 404 for non-existent command', async () => {
      const response = await request(app).post('/shell/queue/cmd_nonexistent/dismiss');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('POST /shell/kill', () => {
    it('returns 400 when neither processId nor pid provided', async () => {
      const response = await request(app).post('/shell/kill').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('returns 404 for non-existent processId', async () => {
      const response = await request(app).post('/shell/kill').send({ processId: 99999 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });
});
