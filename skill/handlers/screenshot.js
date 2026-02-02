const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const screenshotManager = require('../utils/screenshotManager');
const logger = require('../utils/logger');

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: screenshotManager.config.maxUploadSize,
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /screenshot/capture
 * Trigger a screenshot capture (placeholder - actual capture via Playwright MCP)
 *
 * This endpoint is called when the mobile app requests a screenshot.
 * The actual screenshot capture is done via Playwright MCP tool in Claude Code.
 * This endpoint can be used to:
 * 1. Trigger Claude to capture a screenshot
 * 2. Save a screenshot that was captured externally
 */
router.post('/capture', (req, res) => {
  const { selector, fullPage, imagePath } = req.body;

  // If an image path is provided, save it directly
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      const result = screenshotManager.saveScreenshotFromFile(imagePath);

      // Get public URL if available
      const state = require('../utils/state').readState();
      const baseUrl = state.url || `http://localhost:${process.env.SKILL_PORT || 3000}`;
      result.url = `${baseUrl}/screenshot/${result.id}`;

      logger.info('Screenshot saved from file', { id: result.id, path: imagePath });

      // Broadcast to connected clients
      broadcastScreenshotAvailable(result);

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      logger.error('Failed to save screenshot', { error: err.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to save screenshot',
        message: err.message,
      });
    }
  }

  // No image path provided - this is a request for Claude to capture
  // Return instructions for how to capture
  res.json({
    success: true,
    message: 'Screenshot capture requested',
    instructions: 'Use Playwright MCP tool to capture screenshot, then save with POST /screenshot/save',
    options: {
      selector: selector || 'viewport',
      fullPage: fullPage || false,
    },
  });
});

/**
 * POST /screenshot/save
 * Save a screenshot from raw image data
 */
router.post('/save', (req, res) => {
  try {
    const { imageData, format = 'png' } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'imageData is required (base64 encoded)',
      });
    }

    // Decode base64 image
    const buffer = Buffer.from(imageData, 'base64');
    const result = screenshotManager.saveScreenshot(buffer);

    // Get public URL
    const state = require('../utils/state').readState();
    const baseUrl = state.url || `http://localhost:${process.env.SKILL_PORT || 3000}`;
    result.url = `${baseUrl}/screenshot/${result.id}`;

    logger.info('Screenshot saved', { id: result.id, size: result.size });

    // Broadcast to connected clients
    broadcastScreenshotAvailable(result);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error('Failed to save screenshot', { error: err.message });
    res.status(500).json({
      success: false,
      error: 'Failed to save screenshot',
      message: err.message,
    });
  }
});

/**
 * GET /screenshot/latest
 * Get the most recent screenshot
 */
router.get('/latest', (req, res) => {
  try {
    const latest = screenshotManager.getLatestScreenshot();

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: 'No screenshots available',
      });
    }

    const buffer = screenshotManager.getScreenshot(latest.id);
    if (!buffer) {
      return res.status(404).json({
        success: false,
        error: 'Screenshot file not found',
      });
    }

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${latest.id}.png"`);
    res.send(buffer);
  } catch (err) {
    logger.error('Failed to get latest screenshot', { error: err.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get screenshot',
      message: err.message,
    });
  }
});

/**
 * GET /screenshot/:id
 * Get a specific screenshot by ID
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const buffer = screenshotManager.getScreenshot(id);

    if (!buffer) {
      return res.status(404).json({
        success: false,
        error: 'Screenshot not found',
      });
    }

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${id}.png"`);
    res.send(buffer);
  } catch (err) {
    logger.error('Failed to get screenshot', { error: err.message, id });
    res.status(500).json({
      success: false,
      error: 'Failed to get screenshot',
      message: err.message,
    });
  }
});

/**
 * GET /screenshots
 * List all available screenshots
 */
router.get('/', (req, res) => {
  try {
    const screenshots = screenshotManager.listScreenshots();

    // Add URLs to each screenshot
    const state = require('../utils/state').readState();
    const baseUrl = state.url || `http://localhost:${process.env.SKILL_PORT || 3000}`;

    const screenshotsWithUrls = screenshots.map(s => ({
      ...s,
      url: `${baseUrl}/screenshot/${s.id}`,
    }));

    res.json({
      success: true,
      count: screenshots.length,
      screenshots: screenshotsWithUrls,
    });
  } catch (err) {
    logger.error('Failed to list screenshots', { error: err.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list screenshots',
      message: err.message,
    });
  }
});

/**
 * DELETE /screenshot/:id
 * Delete a specific screenshot
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const deleted = screenshotManager.deleteScreenshot(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Screenshot not found',
      });
    }

    logger.info('Screenshot deleted', { id });

    res.json({
      success: true,
      message: 'Screenshot deleted',
    });
  } catch (err) {
    logger.error('Failed to delete screenshot', { error: err.message, id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete screenshot',
      message: err.message,
    });
  }
});

/**
 * POST /image/upload
 * Upload an image from mobile app
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const result = screenshotManager.saveUpload(req.file.buffer, req.file.originalname);

    logger.info('Image uploaded', { id: result.id, size: result.size, name: result.originalName });

    // Broadcast to indicate new image available for Claude
    broadcastImageUploaded(result);

    res.json({
      success: true,
      ...result,
      message: 'Image uploaded and ready for Claude to analyze',
    });
  } catch (err) {
    logger.error('Failed to upload image', { error: err.message });
    res.status(500).json({
      success: false,
      error: 'Failed to upload image',
      message: err.message,
    });
  }
});

/**
 * GET /image/:id
 * Get an uploaded image
 */
router.get('/image/:id', (req, res) => {
  const { id } = req.params;

  try {
    const upload = screenshotManager.getUpload(id);

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: 'Image not found',
      });
    }

    const buffer = fs.readFileSync(upload.path);
    const ext = path.extname(upload.path).slice(1);
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    res.set('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.set('Content-Disposition', `inline; filename="${id}.${ext}"`);
    res.send(buffer);
  } catch (err) {
    logger.error('Failed to get image', { error: err.message, id });
    res.status(500).json({
      success: false,
      error: 'Failed to get image',
      message: err.message,
    });
  }
});

/**
 * GET /images
 * List all uploaded images
 */
router.get('/images', (req, res) => {
  try {
    const uploads = screenshotManager.listUploads();

    // Add URLs
    const state = require('../utils/state').readState();
    const baseUrl = state.url || `http://localhost:${process.env.SKILL_PORT || 3000}`;

    const uploadsWithUrls = uploads.map(u => ({
      ...u,
      url: `${baseUrl}/screenshot/image/${u.id}`,
    }));

    res.json({
      success: true,
      count: uploads.length,
      images: uploadsWithUrls,
    });
  } catch (err) {
    logger.error('Failed to list images', { error: err.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list images',
      message: err.message,
    });
  }
});

/**
 * Broadcast screenshot available to connected clients
 * @param {object} screenshot - Screenshot metadata
 */
function broadcastScreenshotAvailable(screenshot) {
  try {
    // Get the broadcast function from server (late binding)
    const { broadcastMessage, clients } = require('../server');

    if (!clients || clients.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'screenshot.available',
      id: screenshot.id,
      url: screenshot.url,
      timestamp: screenshot.timestamp,
    });

    clients.forEach((client) => {
      if (client.ws.readyState === 1) {
        client.ws.send(message);
      }
    });

    logger.debug('Broadcast screenshot available', { id: screenshot.id });
  } catch (err) {
    // Ignore - server might not be fully initialized
    logger.debug('Could not broadcast screenshot', { error: err.message });
  }
}

/**
 * Broadcast image uploaded to connected clients
 * @param {object} upload - Upload metadata
 */
function broadcastImageUploaded(upload) {
  try {
    const { clients } = require('../server');

    if (!clients || clients.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'image.uploaded',
      id: upload.id,
      path: upload.path,
      originalName: upload.originalName,
      timestamp: upload.timestamp,
    });

    clients.forEach((client) => {
      if (client.ws.readyState === 1) {
        client.ws.send(message);
      }
    });

    logger.debug('Broadcast image uploaded', { id: upload.id });
  } catch (err) {
    logger.debug('Could not broadcast image upload', { error: err.message });
  }
}

module.exports = router;
