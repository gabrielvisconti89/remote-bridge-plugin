#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const PID_FILE = path.join(os.tmpdir(), 'claude-bridge.pid');
const LOG_FILE = path.join(os.tmpdir(), 'claude-bridge.log');
const STATE_DIR = path.join(os.homedir(), '.claude', 'remote-bridge');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');

// Check if running as hook or directly
let isHook = false;
let input = '';

// Set timeout for stdin reading
const stdinTimeout = setTimeout(() => {
  // No stdin input, run directly
  stopServer();
}, 100);

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  clearTimeout(stdinTimeout);
  input += chunk;
  isHook = true;
});
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  if (isHook) {
    try {
      const data = JSON.parse(input || '{}');
      if (data.hook_event_name === 'SessionEnd') {
        stopServer();
      } else {
        process.exit(0);
      }
    } catch (err) {
      // If parsing fails, try to stop anyway
      stopServer();
    }
  }
});

function stopServer() {
  let stopped = false;

  // Try PID file first
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
    try {
      process.kill(pid, 'SIGTERM');
      console.error('Remote Bridge stopped (PID: ' + pid + ')');
      stopped = true;
    } catch (e) {
      // Process might already be dead
    }

    // Clean up PID file
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {
      // Ignore errors removing PID file
    }
  }

  // Also try state file PID
  if (!stopped && fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (state.pid) {
        try {
          process.kill(state.pid, 'SIGTERM');
          console.error('Remote Bridge stopped (PID: ' + state.pid + ')');
          stopped = true;
        } catch (e) {
          // Process might already be dead
        }
      }
    } catch (e) {
      // Invalid state file
    }
  }

  if (!stopped) {
    console.error('Remote Bridge not running');
  }

  // Clear state file (reset to defaults)
  try {
    if (fs.existsSync(STATE_FILE)) {
      const defaultState = {
        enabled: false,
        pid: null,
        url: null,
        apiKey: null,
        connected: false,
        connectedDevice: null,
        startedAt: null,
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(defaultState, null, 2));
    }
  } catch (e) {
    // Ignore errors
  }

  // Clean up log file
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
  } catch (e) {
    // Ignore errors removing log file
  }

  process.exit(0);
}
