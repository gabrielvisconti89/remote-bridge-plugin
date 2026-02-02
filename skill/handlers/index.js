const fileHandler = require('./file');
const shellHandler = require('./shell');
const systemHandler = require('./system');
const modesHandler = require('./modes');

const logger = require('../utils/logger');

/**
 * Register all handlers on Express app
 * @param {Express} app - Express application instance
 */
function register(app) {
  logger.info('Registering handlers');

  // File operations
  app.use('/file', fileHandler);
  logger.debug('Registered /file routes');

  // Shell operations
  app.use('/shell', shellHandler);
  logger.debug('Registered /shell routes');

  // System operations
  app.use('/system', systemHandler);
  logger.debug('Registered /system routes');

  // Mode operations
  app.use('/modes', modesHandler);
  logger.debug('Registered /modes routes');

  logger.info('All handlers registered');
}

module.exports = {
  register,
  fileHandler,
  shellHandler,
  systemHandler,
  modesHandler,
};
