#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

// State files location
const STATE_DIR = path.join(os.homedir(), '.claude', 'remote-bridge');
const COMMANDS_FILE = path.join(STATE_DIR, 'commands.json');

function formatTime(isoString) {
  if (!isoString) return 'Unknown';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'just now';
  }
}

function main() {
  console.log('');
  console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
  console.log('\x1b[36m' + '                   \x1b[1m📬 Remote Bridge Inbox\x1b[0m');
  console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
  console.log('');

  // Read commands file
  let commands = { queue: [] };
  if (fs.existsSync(COMMANDS_FILE)) {
    try {
      commands = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
    } catch (err) {
      console.log('  \x1b[31mError reading commands file\x1b[0m');
      console.log('');
      return;
    }
  }

  // Filter to pending commands only
  const pending = commands.queue.filter(cmd => cmd.status === 'pending');

  if (pending.length === 0) {
    console.log('  \x1b[90mNo pending commands from mobile.\x1b[0m');
    console.log('');
    console.log('  Commands sent from the Remote Bridge mobile app will appear here.');
    console.log('');
    console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
    console.log('');
    return;
  }

  console.log(`  \x1b[33mPending Commands:\x1b[0m ${pending.length}`);
  console.log('');

  // Display each pending command
  pending.forEach((cmd, index) => {
    console.log('\x1b[36m' + '  ─────────────────────────────────────────────────────────────' + '\x1b[0m');
    console.log(`  \x1b[1m#${index + 1}\x1b[0m  ID: \x1b[33m${cmd.id}\x1b[0m`);
    console.log('');
    console.log(`  \x1b[90mCommand:\x1b[0m  \x1b[1m\x1b[32m${cmd.command}\x1b[0m`);
    console.log(`  \x1b[90mFrom:\x1b[0m     📱 ${cmd.from}`);
    console.log(`  \x1b[90mReceived:\x1b[0m ${formatTime(cmd.receivedAt)}`);
    console.log('');
  });

  console.log('\x1b[36m' + '═══════════════════════════════════════════════════════════════' + '\x1b[0m');
  console.log('');
  console.log('  \x1b[90mTo execute a command, use its ID with the API or ask Claude.\x1b[0m');
  console.log('');

  // Output JSON for programmatic use
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(pending, null, 2));
  }
}

main();
