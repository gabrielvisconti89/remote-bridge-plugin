const fs = require('fs');
const path = require('path');
const os = require('os');

// State directory: ~/.claude/remote-bridge/
const STATE_DIR = path.join(os.homedir(), '.claude', 'remote-bridge');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');

/**
 * Ensure state directory exists
 */
function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Get default state
 * @returns {object} Default state object
 */
function getDefaultState() {
  return {
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
  };
}

/**
 * Get default metrics
 * @returns {object} Default metrics object
 */
function getDefaultMetrics() {
  return {
    sent: 0,
    received: 0,
    lastActivity: null,
  };
}

/**
 * Read state from file
 * @returns {object} Current state
 */
function readState() {
  ensureDir();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return { ...getDefaultState(), ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading state:', err.message);
  }
  return getDefaultState();
}

/**
 * Write state to file
 * @param {object} state - State to save
 */
function writeState(state) {
  ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Error writing state:', err.message);
  }
}

/**
 * Update state partially
 * @param {object} updates - Partial state updates
 * @returns {object} Updated state
 */
function updateState(updates) {
  const state = readState();
  const newState = { ...state, ...updates };
  writeState(newState);
  return newState;
}

/**
 * Clear state (reset to defaults)
 */
function clearState() {
  writeState(getDefaultState());
}

/**
 * Read metrics from file
 * @returns {object} Current metrics
 */
function readMetrics() {
  ensureDir();
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = fs.readFileSync(METRICS_FILE, 'utf8');
      return { ...getDefaultMetrics(), ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading metrics:', err.message);
  }
  return getDefaultMetrics();
}

/**
 * Write metrics to file
 * @param {object} metrics - Metrics to save
 */
function writeMetrics(metrics) {
  ensureDir();
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (err) {
    console.error('Error writing metrics:', err.message);
  }
}

/**
 * Increment sent message counter
 */
function incrementSent() {
  const metrics = readMetrics();
  metrics.sent++;
  metrics.lastActivity = new Date().toISOString();
  writeMetrics(metrics);
  return metrics;
}

/**
 * Increment received message counter
 */
function incrementReceived() {
  const metrics = readMetrics();
  metrics.received++;
  metrics.lastActivity = new Date().toISOString();
  writeMetrics(metrics);
  return metrics;
}

/**
 * Reset metrics
 */
function resetMetrics() {
  writeMetrics(getDefaultMetrics());
}

module.exports = {
  STATE_DIR,
  STATE_FILE,
  METRICS_FILE,
  readState,
  writeState,
  updateState,
  clearState,
  readMetrics,
  writeMetrics,
  incrementSent,
  incrementReceived,
  resetMetrics,
  getDefaultState,
  getDefaultMetrics,
};
