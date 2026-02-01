#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const PID_FILE = path.join(os.tmpdir(), 'claude-bridge.pid');
const LOG_FILE = path.join(os.tmpdir(), 'claude-bridge.log');

// Read input from hook
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', main);

function main() {
  try {
    const data = JSON.parse(input || '{}');
    if (data.hook_event_name === 'SessionEnd') {
      stopServer();
    } else {
      // Not a SessionEnd event, just exit
      process.exit(0);
    }
  } catch (err) {
    // If no valid input, still try to stop (manual invocation)
    stopServer();
  }
}

function stopServer() {
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
    try {
      process.kill(pid, 'SIGTERM');
      console.error('Claude Bridge stopped (PID: ' + pid + ')');
    } catch (e) {
      // Process might already be dead
      console.error('Claude Bridge process not found (PID: ' + pid + ')');
    }

    // Clean up PID file
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {
      // Ignore errors removing PID file
    }
  } else {
    console.error('Claude Bridge not running (no PID file found)');
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
