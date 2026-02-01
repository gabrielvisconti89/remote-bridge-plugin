const config = require('./config');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel] || LOG_LEVELS.info;

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @returns {string} Formatted log string
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

/**
 * Log at debug level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function debug(message, meta = {}) {
  if (currentLevel <= LOG_LEVELS.debug) {
    console.log(formatLog('debug', message, meta));
  }
}

/**
 * Log at info level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function info(message, meta = {}) {
  if (currentLevel <= LOG_LEVELS.info) {
    console.log(formatLog('info', message, meta));
  }
}

/**
 * Log at warn level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function warn(message, meta = {}) {
  if (currentLevel <= LOG_LEVELS.warn) {
    console.warn(formatLog('warn', message, meta));
  }
}

/**
 * Log at error level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function error(message, meta = {}) {
  if (currentLevel <= LOG_LEVELS.error) {
    console.error(formatLog('error', message, meta));
  }
}

/**
 * Create HTTP request logger middleware
 * @returns {Function} Express middleware
 */
function httpLogger() {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const meta = {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
      };

      if (res.statusCode >= 400) {
        warn('HTTP Request', meta);
      } else {
        info('HTTP Request', meta);
      }
    });

    next();
  };
}

module.exports = {
  debug,
  info,
  warn,
  error,
  httpLogger,
  LOG_LEVELS,
};
