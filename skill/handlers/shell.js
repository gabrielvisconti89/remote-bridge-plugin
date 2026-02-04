const { spawn, execSync } = require('child_process');
const { Router } = require('express');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

const config = require('../utils/config');
const logger = require('../utils/logger');
const commandQueue = require('../utils/commandQueue');
const screenshotManager = require('../utils/screenshotManager');

// Platform detection
const platform = os.platform();

const router = Router();

// Terminal session identification
let terminalApp = null;
let iTermSessionId = null;
let terminalWindowId = null;

// Detect terminal app and session from environment
const termProgram = process.env.TERM_PROGRAM || '';
iTermSessionId = process.env.ITERM_SESSION_ID || null;
terminalWindowId = process.env.TERM_SESSION_ID || process.env.WINDOWID || null;

if (termProgram.includes('iTerm') || iTermSessionId) {
  terminalApp = 'iTerm2';
} else if (termProgram.includes('Apple_Terminal') || termProgram === 'Apple_Terminal') {
  terminalApp = 'Terminal';
} else if (termProgram) {
  terminalApp = termProgram;
} else {
  terminalApp = 'Terminal'; // Default
}

logger.info('Terminal session config', {
  app: terminalApp,
  termProgram,
  iTermSessionId: iTermSessionId ? iTermSessionId.substring(0, 20) + '...' : null,
  terminalWindowId
});

// Active processes map for tracking/killing
const activeProcesses = new Map();
let processIdCounter = 0;

/**
 * Execute a shell command
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<object>} Execution result
 */
function executeCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      cwd = process.cwd(),
      timeout = config.commandTimeout,
      shell = true,
    } = options;

    const processId = ++processIdCounter;
    const startTime = Date.now();

    logger.debug('Executing command', { processId, command, cwd, timeout });
    // Log command to console
    console.log(`\n📱 [Remote Bridge] Executing: ${command}`);

    const child = spawn(command, [], {
      cwd,
      shell,
      timeout,
    });

    activeProcesses.set(processId, {
      process: child,
      command,
      startTime,
      pid: child.pid,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Log to console so it appears in the terminal
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      // Log to console so it appears in the terminal
      process.stderr.write(text);
    });

    child.on('close', (code, signal) => {
      activeProcesses.delete(processId);
      const duration = Date.now() - startTime;

      logger.debug('Command completed', { processId, code, signal, duration });

      resolve({
        success: code === 0,
        processId,
        command,
        code,
        signal,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration,
      });
    });

    child.on('error', (err) => {
      activeProcesses.delete(processId);
      const duration = Date.now() - startTime;

      logger.error('Command error', { processId, error: err.message });

      reject({
        success: false,
        processId,
        command,
        error: err.message,
        duration,
      });
    });
  });
}

/**
 * POST /shell/exec
 * Execute a shell command
 * Body: { command, cwd?, timeout? }
 */
router.post('/exec', async (req, res, next) => {
  try {
    const { command, cwd, timeout } = req.body;

    if (!command) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Command is required',
      });
    }

    const result = await executeCommand(command, { cwd, timeout });

    res.json(result);
  } catch (err) {
    if (err.processId) {
      return res.status(500).json(err);
    }
    next(err);
  }
});

/**
 * POST /shell/stream
 * Execute command and stream output via WebSocket
 * Body: { command, cwd?, timeout?, clientId }
 */
router.post('/stream', async (req, res, next) => {
  try {
    const { command, cwd, timeout, clientId } = req.body;

    if (!command) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Command is required',
      });
    }

    // Get WebSocket broadcast function from app
    const { clients } = require('../server');
    const client = clients.get(clientId);

    if (!client) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid clientId or client not connected',
      });
    }

    const processId = ++processIdCounter;
    const startTime = Date.now();

    logger.debug('Streaming command', { processId, command, clientId });
    // Log command to console
    console.log(`\n📱 [Remote Bridge] Streaming: ${command}`);

    const child = spawn(command, [], {
      cwd: cwd || process.cwd(),
      shell: true,
      timeout: timeout || config.commandTimeout,
    });

    activeProcesses.set(processId, {
      process: child,
      command,
      startTime,
      pid: child.pid,
      clientId,
    });

    // Send process started message
    client.ws.send(JSON.stringify({
      type: 'shell.started',
      processId,
      command,
      pid: child.pid,
    }));

    child.stdout.on('data', (data) => {
      const text = data.toString();
      // Log to console so it appears in the terminal
      process.stdout.write(text);
      client.ws.send(JSON.stringify({
        type: 'shell.stdout',
        processId,
        data: text,
      }));
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      // Log to console so it appears in the terminal
      process.stderr.write(text);
      client.ws.send(JSON.stringify({
        type: 'shell.stderr',
        processId,
        data: text,
      }));
    });

    child.on('close', (code, signal) => {
      activeProcesses.delete(processId);
      const duration = Date.now() - startTime;

      client.ws.send(JSON.stringify({
        type: 'shell.completed',
        processId,
        code,
        signal,
        duration,
      }));
    });

    child.on('error', (err) => {
      activeProcesses.delete(processId);

      client.ws.send(JSON.stringify({
        type: 'shell.error',
        processId,
        error: err.message,
      }));
    });

    res.json({
      success: true,
      processId,
      command,
      pid: child.pid,
      message: 'Command started, output will be streamed via WebSocket',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /shell/processes
 * List active processes
 */
router.get('/processes', (req, res) => {
  const processes = [];

  activeProcesses.forEach((proc, id) => {
    processes.push({
      processId: id,
      pid: proc.pid,
      command: proc.command,
      startTime: new Date(proc.startTime).toISOString(),
      duration: Date.now() - proc.startTime,
      clientId: proc.clientId,
    });
  });

  res.json({
    success: true,
    count: processes.length,
    processes,
  });
});

/**
 * Type command using macOS AppleScript
 * @param {string} command - Command to type
 * @param {boolean} submit - Whether to press Enter after typing
 * @param {string} app - Terminal app name
 * @returns {Promise<object>} Result
 */
function macOSTyper(command, submit, app) {
  return new Promise((resolve, reject) => {
    // Escape special characters for AppleScript
    const escapedCommand = command
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    let script;

    if (app === 'iTerm2') {
      script = `
        tell application "iTerm2"
          activate
          tell current session of current tab of current window
            write text "${escapedCommand}"${submit ? '' : ' without newline'}
          end tell
        end tell
      `;
    } else {
      // For Terminal.app - more robust approach with proper delays
      script = `
        tell application "${app}"
          activate
          delay 0.2
        end tell
        tell application "System Events"
          tell process "${app}"
            set frontmost to true
            delay 0.1
            keystroke "${escapedCommand}"
            ${submit ? 'delay 0.1\nkeystroke return' : ''}
          end tell
        end tell
      `;
    }

    const child = spawn('osascript', ['-e', script]);

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, app, message: `Command typed to ${app}` });
      } else {
        reject({ success: false, error: 'Failed to type command', details: stderr.trim() });
      }
    });

    child.on('error', (err) => {
      reject({ success: false, error: 'Failed to execute AppleScript', details: err.message });
    });
  });
}

/**
 * Type command using Linux xdotool
 * @param {string} command - Command to type
 * @param {boolean} submit - Whether to press Enter after typing
 * @returns {Promise<object>} Result
 */
function linuxTyper(command, submit) {
  return new Promise((resolve, reject) => {
    // Check if xdotool is available
    try {
      execSync('which xdotool', { stdio: 'ignore' });
    } catch (e) {
      return reject({
        success: false,
        error: 'xdotool not installed',
        details: 'Install xdotool: sudo apt-get install xdotool (Debian/Ubuntu) or sudo dnf install xdotool (Fedora)',
      });
    }

    // Escape special characters for shell
    const escapedCommand = command.replace(/'/g, "'\\''");

    // Type the command
    const typeCmd = `xdotool type --clearmodifiers '${escapedCommand}'`;

    try {
      execSync(typeCmd, { stdio: 'ignore' });

      if (submit) {
        execSync('xdotool key Return', { stdio: 'ignore' });
      }

      resolve({ success: true, app: 'xdotool', message: 'Command typed via xdotool' });
    } catch (err) {
      reject({ success: false, error: 'Failed to type command', details: err.message });
    }
  });
}

/**
 * Type command using Windows PowerShell SendKeys
 * @param {string} command - Command to type
 * @param {boolean} submit - Whether to press Enter after typing
 * @returns {Promise<object>} Result
 */
function windowsTyper(command, submit) {
  return new Promise((resolve, reject) => {
    // Escape special characters for PowerShell
    const escapedCommand = command
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '`"')
      .replace(/\+/g, '{+}')
      .replace(/\^/g, '{^}')
      .replace(/%/g, '{%}')
      .replace(/~/g, '{~}')
      .replace(/\(/g, '{(}')
      .replace(/\)/g, '{)}')
      .replace(/\[/g, '{[}')
      .replace(/\]/g, '{]}');

    const enterKey = submit ? '[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")' : '';

    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${escapedCommand}")
      ${enterKey}
    `;

    const child = spawn('powershell', ['-Command', script], { shell: true });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, app: 'PowerShell', message: 'Command typed via PowerShell SendKeys' });
      } else {
        reject({ success: false, error: 'Failed to type command', details: stderr.trim() });
      }
    });

    child.on('error', (err) => {
      reject({ success: false, error: 'Failed to execute PowerShell', details: err.message });
    });
  });
}

/**
 * Get the appropriate typer function for the current platform
 * @returns {Function|null} Typer function or null if unsupported
 */
function getTerminalTyper() {
  switch (platform) {
    case 'darwin':
      return macOSTyper;
    case 'linux':
      return linuxTyper;
    case 'win32':
      return windowsTyper;
    default:
      return null;
  }
}

/**
 * POST /shell/type
 * Queue a command for review/execution (plug-and-play, no permissions required)
 * Body: { command, deviceName? }
 *
 * NOTE: This endpoint has been changed from "typing mode" (AppleScript) to
 * "command queue mode" for reliability and zero-permission operation.
 * Commands are queued and displayed in the terminal log for the user to review.
 */
router.post('/type', async (req, res, next) => {
  try {
    const { command, deviceName } = req.body;

    if (!command) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Command is required',
      });
    }

    // Get device name from request or connected client
    const device = deviceName || 'Mobile App';

    // Add command to queue
    const entry = commandQueue.addCommand(command, device);

    logger.info('Command queued', { id: entry.id, command, from: device });

    // Display prominent log in terminal
    console.log('');
    console.log('\x1b[36m' + '=' .repeat(60) + '\x1b[0m');
    console.log('\x1b[36m  \x1b[1m\x1b[33m New command received from mobile\x1b[0m');
    console.log('\x1b[36m' + '=' .repeat(60) + '\x1b[0m');
    console.log(`  \x1b[90mFrom:\x1b[0m    ${device}`);
    console.log(`  \x1b[90mCommand:\x1b[0m \x1b[1m${command}\x1b[0m`);
    console.log(`  \x1b[90mID:\x1b[0m      ${entry.id}`);
    console.log('');
    console.log('  \x1b[32mRun /remote-bridge:inbox to view and execute\x1b[0m');
    console.log('\x1b[36m' + '=' .repeat(60) + '\x1b[0m');
    console.log('');

    res.json({
      success: true,
      queued: true,
      id: entry.id,
      command,
      from: device,
      receivedAt: entry.receivedAt,
      message: 'Command queued successfully. Run /remote-bridge:inbox to execute.',
    });
  } catch (err) {
    next(err);
  }
});

// Multer configuration for image uploads
const messageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * POST /shell/message
 * Queue a command with optional image attachment (multipart/form-data)
 * Body: { command, deviceName? } + optional image file
 */
router.post('/message', messageUpload.single('image'), async (req, res, next) => {
  try {
    const { command, deviceName } = req.body;

    if (!command) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Command is required',
      });
    }

    // Get device name from request or default
    const device = deviceName || 'Mobile App';

    let attachment = null;

    // Handle image upload if present
    if (req.file) {
      const upload = screenshotManager.saveUpload(req.file.buffer, req.file.originalname);

      attachment = {
        type: 'image',
        id: upload.id,
        path: upload.path,
        originalName: upload.originalName,
        size: upload.size,
      };
    }

    // Add command to queue with optional attachment
    const entry = commandQueue.addCommand(command, device, attachment);

    logger.info('Message queued', { id: entry.id, command, from: device, hasImage: !!attachment });

    // Display prominent log in terminal
    console.log('');
    console.log('\x1b[36m' + '=' .repeat(60) + '\x1b[0m');
    console.log('\x1b[36m  \x1b[1m\x1b[33m New message received from mobile\x1b[0m');
    console.log('\x1b[36m' + '=' .repeat(60) + '\x1b[0m');
    console.log(`  \x1b[90mFrom:\x1b[0m    ${device}`);
    console.log(`  \x1b[90mCommand:\x1b[0m \x1b[1m${command}\x1b[0m`);
    if (attachment) {
      const sizeKB = Math.round(attachment.size / 1024);
      console.log(`  \x1b[90mImage:\x1b[0m   📎 ${attachment.originalName} (${sizeKB} KB)`);
    }
    console.log(`  \x1b[90mID:\x1b[0m      ${entry.id}`);
    console.log('');
    console.log('  \x1b[32mRun /remote-bridge:inbox to view and execute\x1b[0m');
    console.log('\x1b[36m' + '=' .repeat(60) + '\x1b[0m');
    console.log('');

    res.json({
      success: true,
      queued: true,
      id: entry.id,
      command,
      from: device,
      receivedAt: entry.receivedAt,
      attachment: attachment ? { id: attachment.id, originalName: attachment.originalName } : null,
      message: 'Message queued successfully. Run /remote-bridge:inbox to execute.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /shell/queue
 * List pending commands in the queue
 */
router.get('/queue', (req, res) => {
  const { all } = req.query;

  const commands = all === 'true' ? commandQueue.getAllCommands() : commandQueue.getCommands();

  res.json({
    success: true,
    count: commands.length,
    pendingCount: commandQueue.getPendingCount(),
    commands,
  });
});

/**
 * DELETE /shell/queue/:id
 * Remove a specific command from the queue
 */
router.delete('/queue/:id', (req, res) => {
  const { id } = req.params;

  const removed = commandQueue.clearCommand(id);

  if (!removed) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Command ${id} not found in queue`,
    });
  }

  logger.info('Command removed from queue', { id });

  res.json({
    success: true,
    id,
    message: 'Command removed from queue',
  });
});

/**
 * DELETE /shell/queue
 * Clear all commands from the queue
 */
router.delete('/queue', (req, res) => {
  commandQueue.clearAll();

  logger.info('Command queue cleared');

  res.json({
    success: true,
    message: 'All commands cleared from queue',
  });
});

/**
 * POST /shell/queue/:id/execute
 * Execute a queued command
 */
router.post('/queue/:id/execute', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cwd, timeout } = req.body;

    const cmd = commandQueue.getCommand(id);

    if (!cmd) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Command ${id} not found in queue`,
      });
    }

    if (cmd.status !== 'pending') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Command ${id} has already been ${cmd.status}`,
      });
    }

    // Mark as executed
    commandQueue.updateCommandStatus(id, 'executed');

    logger.info('Executing queued command', { id, command: cmd.command });
    console.log(`\n  [Remote Bridge] Executing queued command: ${cmd.command}`);

    // Execute the command
    const result = await executeCommand(cmd.command, { cwd, timeout });

    res.json({
      ...result,
      queueId: id,
      from: cmd.from,
    });
  } catch (err) {
    if (err.processId) {
      return res.status(500).json(err);
    }
    next(err);
  }
});

/**
 * POST /shell/queue/:id/dismiss
 * Dismiss a queued command without executing
 */
router.post('/queue/:id/dismiss', (req, res) => {
  const { id } = req.params;

  const cmd = commandQueue.getCommand(id);

  if (!cmd) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Command ${id} not found in queue`,
    });
  }

  commandQueue.updateCommandStatus(id, 'dismissed');

  logger.info('Command dismissed', { id, command: cmd.command });

  res.json({
    success: true,
    id,
    command: cmd.command,
    message: 'Command dismissed',
  });
});

/**
 * POST /shell/kill
 * Kill an active process
 * Body: { processId } or { pid }
 */
router.post('/kill', (req, res) => {
  const { processId, pid, signal = 'SIGTERM' } = req.body;

  if (processId) {
    const proc = activeProcesses.get(processId);
    if (!proc) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Process ${processId} not found`,
      });
    }

    proc.process.kill(signal);
    logger.info('Process killed', { processId, signal });

    return res.json({
      success: true,
      processId,
      signal,
    });
  }

  if (pid) {
    try {
      process.kill(pid, signal);
      logger.info('PID killed', { pid, signal });

      return res.json({
        success: true,
        pid,
        signal,
      });
    } catch (err) {
      return res.status(400).json({
        error: 'Kill Failed',
        message: err.message,
      });
    }
  }

  res.status(400).json({
    error: 'Bad Request',
    message: 'processId or pid is required',
  });
});

module.exports = router;
