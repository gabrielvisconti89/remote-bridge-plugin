const fs = require('fs').promises;
const path = require('path');
const { Router } = require('express');

const config = require('../utils/config');
const logger = require('../utils/logger');

const router = Router();

/**
 * Validate and resolve file path
 * @param {string} filePath - Path to validate
 * @returns {string} Resolved absolute path
 * @throws {Error} If path is invalid
 */
function resolvePath(filePath) {
  if (!filePath) {
    throw new Error('Path is required');
  }

  const resolved = path.resolve(filePath);
  return resolved;
}

/**
 * GET /file/read
 * Read file contents
 * Query params: path, encoding (default: utf8)
 */
router.get('/read', async (req, res, next) => {
  try {
    const { path: filePath, encoding = 'utf8' } = req.query;
    const resolved = resolvePath(filePath);

    logger.debug('Reading file', { path: resolved });

    const stats = await fs.stat(resolved);

    if (stats.size > config.maxFileSize) {
      return res.status(413).json({
        error: 'File Too Large',
        message: `File size ${stats.size} exceeds limit ${config.maxFileSize}`,
      });
    }

    const content = await fs.readFile(resolved, encoding);

    res.json({
      success: true,
      path: resolved,
      size: stats.size,
      content,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Not Found', message: 'File not found' });
    }
    if (err.code === 'EACCES') {
      return res.status(403).json({ error: 'Forbidden', message: 'Permission denied' });
    }
    next(err);
  }
});

/**
 * POST /file/write
 * Write content to file
 * Body: { path, content, encoding?, append? }
 */
router.post('/write', async (req, res, next) => {
  try {
    const { path: filePath, content, encoding = 'utf8', append = false } = req.body;
    const resolved = resolvePath(filePath);

    logger.debug('Writing file', { path: resolved, append });

    // Ensure directory exists
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });

    if (append) {
      await fs.appendFile(resolved, content, encoding);
    } else {
      await fs.writeFile(resolved, content, encoding);
    }

    const stats = await fs.stat(resolved);

    res.json({
      success: true,
      path: resolved,
      size: stats.size,
      append,
    });
  } catch (err) {
    if (err.code === 'EACCES') {
      return res.status(403).json({ error: 'Forbidden', message: 'Permission denied' });
    }
    next(err);
  }
});

/**
 * GET /file/list
 * List directory contents
 * Query params: path
 */
router.get('/list', async (req, res, next) => {
  try {
    const { path: dirPath } = req.query;
    const resolved = resolvePath(dirPath);

    logger.debug('Listing directory', { path: resolved });

    const entries = await fs.readdir(resolved, { withFileTypes: true });

    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(resolved, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        } catch {
          return {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            error: 'Could not read stats',
          };
        }
      })
    );

    res.json({
      success: true,
      path: resolved,
      count: items.length,
      items,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Not Found', message: 'Directory not found' });
    }
    if (err.code === 'ENOTDIR') {
      return res.status(400).json({ error: 'Bad Request', message: 'Path is not a directory' });
    }
    if (err.code === 'EACCES') {
      return res.status(403).json({ error: 'Forbidden', message: 'Permission denied' });
    }
    next(err);
  }
});

/**
 * DELETE /file/delete
 * Delete file or directory
 * Query params: path, recursive (for directories)
 */
router.delete('/delete', async (req, res, next) => {
  try {
    const { path: filePath, recursive = 'false' } = req.query;
    const resolved = resolvePath(filePath);
    const isRecursive = recursive === 'true';

    logger.debug('Deleting', { path: resolved, recursive: isRecursive });

    const stats = await fs.stat(resolved);

    if (stats.isDirectory()) {
      await fs.rm(resolved, { recursive: isRecursive });
    } else {
      await fs.unlink(resolved);
    }

    res.json({
      success: true,
      path: resolved,
      type: stats.isDirectory() ? 'directory' : 'file',
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Not Found', message: 'Path not found' });
    }
    if (err.code === 'EACCES') {
      return res.status(403).json({ error: 'Forbidden', message: 'Permission denied' });
    }
    if (err.code === 'ENOTEMPTY') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Directory not empty. Use recursive=true to delete.',
      });
    }
    next(err);
  }
});

/**
 * GET /file/exists
 * Check if file or directory exists
 * Query params: path
 */
router.get('/exists', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    const resolved = resolvePath(filePath);

    const stats = await fs.stat(resolved);

    res.json({
      success: true,
      exists: true,
      path: resolved,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.json({
        success: true,
        exists: false,
        path: req.query.path,
      });
    }
    res.json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
