const fs = require('fs');
const path = require('path');

// Mock the state module paths before requiring
jest.mock('os', () => ({
  homedir: () => global.TEST_STATE_DIR,
  platform: () => 'darwin',
}));

// Clear require cache and require fresh module
let state;

beforeEach(() => {
  // Clear module cache
  jest.resetModules();
  // Require fresh state module
  state = require('../../utils/state');
  // Ensure clean state before each test
  state.clearState();
  state.resetMetrics();
});

describe('state utility', () => {
  describe('getDefaultState', () => {
    it('returns correct default state structure', () => {
      const defaultState = state.getDefaultState();

      expect(defaultState).toEqual({
        enabled: false,
        pid: null,
        url: null,
        apiKey: null,
        connected: false,
        connectedDevice: null,
        startedAt: null,
        modes: {
          plan: false,
          autoAccept: false,
        },
      });
    });
  });

  describe('getDefaultMetrics', () => {
    it('returns correct default metrics structure', () => {
      const defaultMetrics = state.getDefaultMetrics();

      expect(defaultMetrics).toEqual({
        sent: 0,
        received: 0,
        lastActivity: null,
      });
    });
  });

  describe('readState', () => {
    it('returns default state when no file exists', () => {
      const result = state.readState();

      expect(result).toEqual(state.getDefaultState());
    });

    it('returns saved state when file exists', () => {
      const testState = {
        enabled: true,
        pid: 12345,
        url: 'https://test.example.com',
        apiKey: 'test-api-key',
        connected: true,
        connectedDevice: 'Test Device',
        startedAt: '2024-01-01T00:00:00.000Z',
        modes: {
          plan: true,
          autoAccept: false,
        },
      };

      state.writeState(testState);
      const result = state.readState();

      expect(result).toEqual(testState);
    });

    it('merges with defaults when file has partial data', () => {
      const stateDir = path.join(global.TEST_STATE_DIR, '.claude', 'remote-bridge');
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(
        path.join(stateDir, 'state.json'),
        JSON.stringify({ enabled: true })
      );

      const result = state.readState();

      expect(result.enabled).toBe(true);
      expect(result.pid).toBeNull();
      expect(result.modes).toEqual({ plan: false, autoAccept: false });
    });
  });

  describe('writeState', () => {
    it('writes state to file', () => {
      const testState = {
        ...state.getDefaultState(),
        enabled: true,
        pid: 99999,
      };

      state.writeState(testState);

      const stateFile = path.join(global.TEST_STATE_DIR, '.claude', 'remote-bridge', 'state.json');
      expect(fs.existsSync(stateFile)).toBe(true);

      const savedData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      expect(savedData).toEqual(testState);
    });

    it('creates directory if it does not exist', () => {
      const stateDir = path.join(global.TEST_STATE_DIR, '.claude', 'remote-bridge');
      if (fs.existsSync(stateDir)) {
        fs.rmSync(stateDir, { recursive: true, force: true });
      }

      state.writeState({ ...state.getDefaultState(), enabled: true });

      expect(fs.existsSync(stateDir)).toBe(true);
    });
  });

  describe('updateState', () => {
    it('updates state partially', () => {
      state.writeState(state.getDefaultState());

      const result = state.updateState({ enabled: true, pid: 11111 });

      expect(result.enabled).toBe(true);
      expect(result.pid).toBe(11111);
      expect(result.connected).toBe(false);
    });

    it('preserves existing values not in update', () => {
      state.writeState({
        ...state.getDefaultState(),
        url: 'https://existing.com',
        apiKey: 'existing-key',
      });

      state.updateState({ enabled: true });
      const result = state.readState();

      expect(result.url).toBe('https://existing.com');
      expect(result.apiKey).toBe('existing-key');
      expect(result.enabled).toBe(true);
    });
  });

  describe('clearState', () => {
    it('resets state to defaults', () => {
      state.writeState({
        enabled: true,
        pid: 12345,
        url: 'https://test.com',
        apiKey: 'test-key',
        connected: true,
        connectedDevice: 'Device',
        startedAt: '2024-01-01T00:00:00.000Z',
        modes: { plan: true, autoAccept: true },
      });

      state.clearState();
      const result = state.readState();

      expect(result).toEqual(state.getDefaultState());
    });
  });

  describe('readMetrics', () => {
    it('returns default metrics when no file exists', () => {
      const result = state.readMetrics();

      expect(result).toEqual(state.getDefaultMetrics());
    });

    it('returns saved metrics when file exists', () => {
      const testMetrics = {
        sent: 100,
        received: 50,
        lastActivity: '2024-01-01T12:00:00.000Z',
      };

      state.writeMetrics(testMetrics);
      const result = state.readMetrics();

      expect(result).toEqual(testMetrics);
    });
  });

  describe('incrementSent', () => {
    it('increments sent counter', () => {
      state.resetMetrics();

      state.incrementSent();
      state.incrementSent();
      state.incrementSent();

      const result = state.readMetrics();
      expect(result.sent).toBe(3);
    });

    it('updates lastActivity timestamp', () => {
      const beforeTime = new Date().toISOString();

      state.incrementSent();

      const result = state.readMetrics();
      expect(result.lastActivity).toBeDefined();
      expect(new Date(result.lastActivity).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });
  });

  describe('incrementReceived', () => {
    it('increments received counter', () => {
      state.resetMetrics();

      state.incrementReceived();
      state.incrementReceived();

      const result = state.readMetrics();
      expect(result.received).toBe(2);
    });

    it('updates lastActivity timestamp', () => {
      const beforeTime = new Date().toISOString();

      state.incrementReceived();

      const result = state.readMetrics();
      expect(result.lastActivity).toBeDefined();
      expect(new Date(result.lastActivity).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });
  });

  describe('resetMetrics', () => {
    it('resets all metrics to defaults', () => {
      state.incrementSent();
      state.incrementSent();
      state.incrementReceived();

      state.resetMetrics();
      const result = state.readMetrics();

      expect(result).toEqual(state.getDefaultMetrics());
    });
  });
});
