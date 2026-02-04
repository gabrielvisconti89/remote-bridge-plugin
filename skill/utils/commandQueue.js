const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// State directory: ~/.claude/remote-bridge/
const STATE_DIR = path.join(os.homedir(), '.claude', 'remote-bridge');
const COMMANDS_FILE = path.join(STATE_DIR, 'commands.json');

/**
 * Ensure state directory exists
 */
function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Get default commands structure
 * @returns {object} Default commands object
 */
function getDefaultCommands() {
  return {
    queue: [],
  };
}

/**
 * Read commands from file
 * @returns {object} Current commands data
 */
function readCommands() {
  ensureDir();
  try {
    if (fs.existsSync(COMMANDS_FILE)) {
      const data = fs.readFileSync(COMMANDS_FILE, 'utf8');
      return { ...getDefaultCommands(), ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading commands:', err.message);
  }
  return getDefaultCommands();
}

/**
 * Write commands to file
 * @param {object} commands - Commands data to save
 */
function writeCommands(commands) {
  ensureDir();
  try {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2));
  } catch (err) {
    console.error('Error writing commands:', err.message);
  }
}

/**
 * Generate a unique command ID
 * @returns {string} Command ID
 */
function generateId() {
  return 'cmd_' + crypto.randomBytes(6).toString('hex');
}

/**
 * Add a command to the queue
 * @param {string} command - Command to queue
 * @param {string} deviceName - Name of the device that sent the command
 * @param {object|null} attachment - Optional attachment metadata (e.g., image)
 * @returns {object} The added command entry
 */
function addCommand(command, deviceName = 'Unknown Device', attachment = null) {
  const commands = readCommands();

  const entry = {
    id: generateId(),
    command,
    receivedAt: new Date().toISOString(),
    from: deviceName,
    status: 'pending',
  };

  if (attachment) {
    entry.attachment = attachment;
  }

  commands.queue.push(entry);
  writeCommands(commands);

  return entry;
}

/**
 * Get all pending commands
 * @returns {Array} List of pending commands
 */
function getCommands() {
  const commands = readCommands();
  return commands.queue.filter(cmd => cmd.status === 'pending');
}

/**
 * Get all commands (including non-pending)
 * @returns {Array} List of all commands
 */
function getAllCommands() {
  const commands = readCommands();
  return commands.queue;
}

/**
 * Get a specific command by ID
 * @param {string} id - Command ID
 * @returns {object|null} Command entry or null if not found
 */
function getCommand(id) {
  const commands = readCommands();
  return commands.queue.find(cmd => cmd.id === id) || null;
}

/**
 * Update a command's status
 * @param {string} id - Command ID
 * @param {string} status - New status ('pending', 'executed', 'dismissed')
 * @returns {object|null} Updated command entry or null if not found
 */
function updateCommandStatus(id, status) {
  const commands = readCommands();
  const index = commands.queue.findIndex(cmd => cmd.id === id);

  if (index === -1) {
    return null;
  }

  commands.queue[index].status = status;
  commands.queue[index].updatedAt = new Date().toISOString();
  writeCommands(commands);

  return commands.queue[index];
}

/**
 * Remove a command from the queue
 * @param {string} id - Command ID
 * @returns {boolean} True if removed, false if not found
 */
function clearCommand(id) {
  const commands = readCommands();
  const index = commands.queue.findIndex(cmd => cmd.id === id);

  if (index === -1) {
    return false;
  }

  commands.queue.splice(index, 1);
  writeCommands(commands);

  return true;
}

/**
 * Clear all commands from the queue
 */
function clearAll() {
  writeCommands(getDefaultCommands());
}

/**
 * Clear only executed/dismissed commands, keep pending
 */
function clearCompleted() {
  const commands = readCommands();
  commands.queue = commands.queue.filter(cmd => cmd.status === 'pending');
  writeCommands(commands);
}

/**
 * Get the count of pending commands
 * @returns {number} Count of pending commands
 */
function getPendingCount() {
  return getCommands().length;
}

module.exports = {
  STATE_DIR,
  COMMANDS_FILE,
  addCommand,
  getCommands,
  getAllCommands,
  getCommand,
  updateCommandStatus,
  clearCommand,
  clearAll,
  clearCompleted,
  getPendingCount,
};
