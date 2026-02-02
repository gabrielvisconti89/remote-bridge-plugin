const fs = require('fs');
const path = require('path');
const os = require('os');

// Test state directory - use a temp directory to avoid polluting real state
const TEST_STATE_DIR = path.join(os.tmpdir(), 'remote-bridge-test-' + process.pid);

// Store original environment
const originalEnv = { ...process.env };

beforeAll(() => {
  // Create test state directory
  if (!fs.existsSync(TEST_STATE_DIR)) {
    fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test state directory
  if (fs.existsSync(TEST_STATE_DIR)) {
    fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
  }
  // Restore environment
  process.env = originalEnv;
});

// Export test directory for use in tests
global.TEST_STATE_DIR = TEST_STATE_DIR;

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
