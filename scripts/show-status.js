#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

// State files location
const STATE_DIR = path.join(os.homedir(), '.claude', 'remote-bridge');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');
const PID_FILE = path.join(os.tmpdir(), 'claude-bridge.pid');

function formatUptime(startedAt) {
  if (!startedAt) return 'Unknown';

  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now - start;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function checkProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function main() {
  console.log('');
  console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
  console.log('\x1b[36m' + '                   \x1b[1m🌐 Remote Bridge Status\x1b[0m');
  console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
  console.log('');

  // Check if state file exists
  let state = null;
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (err) {
      // Invalid state file
    }
  }

  // Check if process is actually running
  let isRunning = false;
  let pid = null;

  if (fs.existsSync(PID_FILE)) {
    try {
      pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
      isRunning = checkProcessRunning(pid);
    } catch (e) {
      // Invalid PID file
    }
  }

  // Also check state's PID
  if (state && state.pid && !isRunning) {
    isRunning = checkProcessRunning(state.pid);
    if (isRunning) pid = state.pid;
  }

  if (!isRunning) {
    console.log('  \x1b[33mServer:\x1b[0m     \x1b[31m● Not Running\x1b[0m');
    console.log('');
    console.log('  Use \x1b[32m/remote-bridge:start\x1b[0m to start the server');
    console.log('');
    console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
    console.log('');
    return;
  }

  // Server is running
  console.log('  \x1b[33mServer:\x1b[0m     \x1b[32m● Running\x1b[0m (PID: ' + pid + ')');

  if (state) {
    console.log('  \x1b[33mURL:\x1b[0m        \x1b[36m' + (state.url || 'N/A') + '\x1b[0m');
    console.log('  \x1b[33mAPI Key:\x1b[0m    \x1b[90m' + (state.apiKey || 'N/A') + '\x1b[0m');
    console.log('  \x1b[33mUptime:\x1b[0m     ' + formatUptime(state.startedAt));
    console.log('');

    if (state.connected && state.connectedDevice) {
      console.log('  \x1b[33mConnection:\x1b[0m \x1b[32m● Connected\x1b[0m');
      console.log('  \x1b[33mDevice:\x1b[0m     📱 ' + state.connectedDevice);
    } else {
      console.log('  \x1b[33mConnection:\x1b[0m \x1b[33m○ Waiting for app...\x1b[0m');
    }
  }

  // Read metrics
  let metrics = { sent: 0, received: 0, lastActivity: null };
  if (fs.existsSync(METRICS_FILE)) {
    try {
      metrics = { ...metrics, ...JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')) };
    } catch (err) {
      // Invalid metrics file
    }
  }

  console.log('');
  console.log('  \x1b[33mMessages:\x1b[0m   ↑ ' + metrics.sent + ' sent  |  ↓ ' + metrics.received + ' received');

  if (metrics.lastActivity) {
    const lastActivity = new Date(metrics.lastActivity);
    console.log('  \x1b[33mLast Activity:\x1b[0m ' + lastActivity.toLocaleString());
  }

  console.log('');
  console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
  console.log('');

  if (!state || !state.connected) {
    console.log('  💡 Scan the QR code to connect: \x1b[32m/remote-bridge:start\x1b[0m');
    console.log('');
  }
}

main();
