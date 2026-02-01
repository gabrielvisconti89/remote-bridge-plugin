const path = require('path');

// Load .env file if exists
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  // Server
  port: parseInt(process.env.SKILL_PORT, 10) || 3000,
  host: process.env.SKILL_HOST || '0.0.0.0',

  // Logging
  logLevel: process.env.SKILL_LOG_LEVEL || 'info',

  // Security
  apiKey: process.env.SKILL_API_KEY || null,

  // Limits
  maxFileSize: parseInt(process.env.SKILL_MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
  commandTimeout: parseInt(process.env.SKILL_COMMAND_TIMEOUT, 10) || 30000, // 30s

  // WebSocket
  wsHeartbeatInterval: parseInt(process.env.SKILL_WS_HEARTBEAT, 10) || 30000, // 30s

  // Paths
  basePath: path.join(__dirname, '..'),
};

/**
 * Validate configuration
 * @returns {boolean} true if valid
 * @throws {Error} if invalid
 */
function validate() {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}`);
  }

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(`Invalid log level: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
  }

  return true;
}

module.exports = {
  ...config,
  validate,
};
