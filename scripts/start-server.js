#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SKILL_DIR = path.join(__dirname, '..', 'skill');
const PID_FILE = path.join(os.tmpdir(), 'claude-bridge.pid');
const LOG_FILE = path.join(os.tmpdir(), 'claude-bridge.log');
const STATE_DIR = path.join(os.homedir(), '.claude', 'remote-bridge');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// Ensure state directory exists
if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

// Check if running as hook or directly
let isHook = false;
let input = '';

// Set timeout for stdin reading
const stdinTimeout = setTimeout(() => {
  // No stdin input, run directly
  startServer();
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
      if (data.hook_event_name === 'SessionStart') {
        startServer();
      } else {
        process.exit(0);
      }
    } catch (err) {
      // If parsing fails, try to start anyway
      startServer();
    }
  }
});

function startServer() {
  // Check if already running
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
    try {
      process.kill(pid, 0); // Check if process exists
      console.error(`Remote Bridge already running (PID: ${pid})`);
      // Show QR code for existing server
      showQRCode();
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

  console.error('');
  console.error('Starting Remote Bridge server...');

  // Wait for server to start and state to be written
  waitForState(child.pid, 0);
}

function waitForState(pid, attempts) {
  const maxAttempts = 20; // 10 seconds max wait
  const delay = 500;

  setTimeout(() => {
    // Check if state file exists with URL
    if (fs.existsSync(STATE_FILE)) {
      try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (state.url && state.apiKey) {
          console.error(`Remote Bridge started (PID: ${pid})`);
          console.error('');
          // Show QR code
          showQRCode();
          process.exit(0);
        }
      } catch (e) {
        // State not ready yet
      }
    }

    if (attempts >= maxAttempts) {
      // Fallback to reading log file
      try {
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        const urlMatch = content.match(/Public URL:\s*(\S+)/);
        const keyMatch = content.match(/API Key:\s*(\S+)/);

        console.error('');
        console.error('=== Remote Bridge ===');
        if (urlMatch) console.error(`URL: ${urlMatch[1]}`);
        if (keyMatch) console.error(`Key: ${keyMatch[1]}`);
        console.error(`PID: ${pid}`);
        console.error('=====================');
        console.error('');
      } catch (err) {
        console.error('Remote Bridge started but could not read connection info');
        console.error(`Check log: ${LOG_FILE}`);
      }
      process.exit(0);
    } else {
      waitForState(pid, attempts + 1);
    }
  }, delay);
}

function showQRCode() {
  try {
    const qrcodeScript = path.join(__dirname, 'show-qrcode.js');
    if (fs.existsSync(qrcodeScript)) {
      execSync(`node "${qrcodeScript}"`, { stdio: 'inherit' });
    }
  } catch (err) {
    // QR code display failed, show text info instead
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.error('');
      console.error('=== Remote Bridge ===');
      console.error(`URL: ${state.url}`);
      console.error(`Key: ${state.apiKey}`);
      console.error('=====================');
      console.error('');
    }
  }
}
