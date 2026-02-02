#!/usr/bin/env node

/**
 * PostToolUse Hook - Sends tool usage info to Remote Bridge
 * This hook fires after Claude uses any tool (Bash, Edit, Write, Read, etc.)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.homedir(), '.claude', 'remote-bridge', 'state.json');

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    // Ignore
  }
  return null;
}

function sendToPlugin(data) {
  const state = readState();
  if (!state || !state.enabled || !state.apiKey) {
    return; // Plugin not running
  }

  const postData = JSON.stringify(data);
  const port = 3000; // Default port

  const req = http.request({
    hostname: 'localhost',
    port: port,
    path: '/claude/activity',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': state.apiKey,
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 2000
  }, (res) => {
    // Ignore response
  });

  req.on('error', () => {
    // Ignore errors - plugin might not be running
  });

  req.write(postData);
  req.end();
}

// Read hook data from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(input);

    // Extract relevant info
    const activity = {
      type: 'tool_use',
      tool: hookData.tool_name || hookData.toolName || 'unknown',
      timestamp: new Date().toISOString()
    };

    // Add tool-specific info
    if (hookData.tool_input) {
      // For Bash commands
      if (hookData.tool_input.command) {
        activity.command = hookData.tool_input.command.substring(0, 200);
      }
      // For file operations
      if (hookData.tool_input.file_path || hookData.tool_input.path) {
        activity.path = hookData.tool_input.file_path || hookData.tool_input.path;
      }
    }

    // Add tool result summary if available
    if (hookData.tool_result) {
      if (typeof hookData.tool_result === 'string') {
        activity.result = hookData.tool_result.substring(0, 500);
      } else if (hookData.tool_result.stdout) {
        activity.result = hookData.tool_result.stdout.substring(0, 500);
      }
    }

    sendToPlugin(activity);
  } catch (err) {
    // Silently fail - don't interrupt Claude
  }
});
