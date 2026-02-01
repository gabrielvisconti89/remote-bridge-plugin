#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SKILL_DIR = path.join(__dirname, '..', 'skill');
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
    if (data.hook_event_name === 'SessionStart') {
      startServer();
    } else {
      // Not a SessionStart event, just exit
      process.exit(0);
    }
  } catch (err) {
    console.error('Error parsing hook input:', err.message);
    process.exit(1);
  }
}

function startServer() {
  // Check if already running
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
    try {
      process.kill(pid, 0); // Check if process exists
      console.error(`Claude Bridge already running (PID: ${pid})`);
      process.exit(0);
    } catch (e) {
      // Process doesn't exist, clean up stale PID file
      fs.unlinkSync(PID_FILE);
    }
  }

  // Check if skill directory exists
  if (!fs.existsSync(SKILL_DIR)) {
    console.error('Error: skill directory not found at', SKILL_DIR);
    process.exit(1);
  }

  // Check if node_modules exists
  const nodeModulesPath = path.join(SKILL_DIR, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('Error: Dependencies not installed. Run: npm install in skill/');
    process.exit(1);
  }

  // Open log file
  const log = fs.openSync(LOG_FILE, 'w');

  // Start server in background
  const child = spawn('node', ['server.js'], {
    cwd: SKILL_DIR,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  // Write PID file
  fs.writeFileSync(PID_FILE, String(child.pid));
  child.unref();

  // Wait for server to start and read connection info
  setTimeout(() => {
    try {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      const urlMatch = content.match(/Public URL:\s*(\S+)/);
      const keyMatch = content.match(/API Key:\s*(\S+)/);

      console.error('');
      console.error('=== Claude Bridge ===');
      if (urlMatch) {
        console.error(`URL: ${urlMatch[1]}`);
      }
      if (keyMatch) {
        console.error(`Key: ${keyMatch[1]}`);
      }
      console.error(`PID: ${child.pid}`);
      console.error('=====================');
      console.error('');

      process.exit(0);
    } catch (err) {
      console.error('Claude Bridge started but could not read connection info');
      console.error(`Check log: ${LOG_FILE}`);
      process.exit(0);
    }
  }, 4000);
}
