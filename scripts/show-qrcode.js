#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// State file location
const STATE_FILE = path.join(os.homedir(), '.claude', 'remote-bridge', 'state.json');
const SKILL_DIR = path.join(__dirname, '..', 'skill');

// Try to use qrcode-terminal from skill directory, install if needed
let qrcode;
const qrcodePath = path.join(SKILL_DIR, 'node_modules', 'qrcode-terminal');
try {
  qrcode = require(qrcodePath);
} catch (err) {
  // Auto-install dependencies
  console.error('Installing dependencies...');
  try {
    execSync('npm install --silent', { cwd: SKILL_DIR, stdio: 'inherit' });
    qrcode = require(qrcodePath);
  } catch (installErr) {
    console.error('Error: Failed to install dependencies. Run manually: cd skill && npm install');
    process.exit(1);
  }
}

function main() {
  // Read state file
  if (!fs.existsSync(STATE_FILE)) {
    console.error('Remote Bridge is not running. Use /remote-bridge:start first.');
    process.exit(1);
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading state file:', err.message);
    process.exit(1);
  }

  if (!state.enabled || !state.url) {
    console.error('Remote Bridge is not running. Use /remote-bridge:start first.');
    process.exit(1);
  }

  // Create QR code data as JSON
  const qrData = JSON.stringify({
    url: state.url,
    key: state.apiKey,
  });

  // Display QR code box
  console.log('');
  console.log('\x1b[36m' + '╭─────────────────────────────────────────────────────────────╮' + '\x1b[0m');
  console.log('\x1b[36m' + '│\x1b[0m' + '          \x1b[1m🌐 Remote Bridge - Aguardando Conexão...\x1b[0m          ' + '\x1b[36m│\x1b[0m');
  console.log('\x1b[36m' + '├─────────────────────────────────────────────────────────────┤' + '\x1b[0m');
  console.log('\x1b[36m│\x1b[0m                                                             \x1b[36m│\x1b[0m');

  // Generate QR code (small version)
  qrcode.generate(qrData, { small: true }, (qrString) => {
    // Center the QR code
    const lines = qrString.split('\n');
    lines.forEach(line => {
      const padding = Math.max(0, Math.floor((61 - line.length) / 2));
      console.log('\x1b[36m│\x1b[0m' + ' '.repeat(padding) + line + ' '.repeat(61 - padding - line.length) + '\x1b[36m│\x1b[0m');
    });

    console.log('\x1b[36m│\x1b[0m                                                             \x1b[36m│\x1b[0m');
    console.log('\x1b[36m│\x1b[0m  \x1b[33mEscaneie com o app Remote Bridge para conectar\x1b[0m             \x1b[36m│\x1b[0m');
    console.log('\x1b[36m│\x1b[0m                                                             \x1b[36m│\x1b[0m');
    console.log('\x1b[36m├─────────────────────────────────────────────────────────────┤\x1b[0m');

    // Truncate URL if too long
    const displayUrl = state.url.length > 45 ? state.url.substring(0, 45) + '...' : state.url;
    const urlPadding = 45 - displayUrl.length;
    console.log('\x1b[36m│\x1b[0m  URL: \x1b[32m' + displayUrl + '\x1b[0m' + ' '.repeat(urlPadding + 7) + '\x1b[36m│\x1b[0m');

    // Truncate key if too long
    const displayKey = state.apiKey.length > 45 ? state.apiKey.substring(0, 45) + '...' : state.apiKey;
    const keyPadding = 45 - displayKey.length;
    console.log('\x1b[36m│\x1b[0m  Key: \x1b[32m' + displayKey + '\x1b[0m' + ' '.repeat(keyPadding + 7) + '\x1b[36m│\x1b[0m');

    console.log('\x1b[36m' + '╰─────────────────────────────────────────────────────────────╯' + '\x1b[0m');
    console.log('');
  });
}

main();
