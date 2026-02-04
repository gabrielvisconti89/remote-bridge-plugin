const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Screenshot storage directory
const SCREENSHOTS_DIR = path.join(os.homedir(), '.claude', 'remote-bridge', 'screenshots');
const UPLOADS_DIR = path.join(os.homedir(), '.claude', 'remote-bridge', 'uploads');

// Configuration
const config = {
  maxScreenshots: 100,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  maxUploadSize: 10 * 1024 * 1024, // 10MB
  importSources: [
    // Default sources to scan for images
    '../.playwright-mcp',
    '.playwright-mcp',
  ],
};

// Track imported files to avoid duplicates (by source path hash)
const IMPORTED_REGISTRY = path.join(os.homedir(), '.claude', 'remote-bridge', 'imported.json');

/**
 * Get or create imported files registry
 * @returns {object} Registry of imported file hashes
 */
function getImportedRegistry() {
  try {
    if (fs.existsSync(IMPORTED_REGISTRY)) {
      return JSON.parse(fs.readFileSync(IMPORTED_REGISTRY, 'utf8'));
    }
  } catch (err) {
    // Ignore errors, return empty registry
  }
  return {};
}

/**
 * Save imported files registry
 * @param {object} registry - Registry to save
 */
function saveImportedRegistry(registry) {
  const dir = path.dirname(IMPORTED_REGISTRY);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(IMPORTED_REGISTRY, JSON.stringify(registry, null, 2));
}

/**
 * Calculate file hash for deduplication
 * @param {string} filePath - Path to file
 * @returns {string} MD5 hash of file
 */
function getFileHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Import screenshots from external source folders
 * @param {string[]} sources - Array of folder paths to scan
 * @returns {object[]} Array of newly imported screenshot metadata
 */
function importFromSources(sources = []) {
  ensureDirs();

  const registry = getImportedRegistry();
  const imported = [];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

  for (const source of sources) {
    // Resolve relative paths from cwd
    const sourcePath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);

    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const files = fs.readdirSync(sourcePath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!imageExtensions.includes(ext)) {
        continue;
      }

      const filePath = path.join(sourcePath, file);
      const stats = fs.statSync(filePath);

      // Skip directories
      if (stats.isDirectory()) {
        continue;
      }

      // Check if already imported by path+mtime
      const registryKey = `${filePath}:${stats.mtime.getTime()}`;
      if (registry[registryKey]) {
        continue;
      }

      // Import the file
      try {
        const result = saveScreenshotFromFile(filePath);
        result.originalName = file;
        result.sourcePath = filePath;
        imported.push(result);

        // Mark as imported
        registry[registryKey] = {
          id: result.id,
          importedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.error(`Error importing ${file}:`, err.message);
      }
    }
  }

  // Save updated registry
  if (imported.length > 0) {
    saveImportedRegistry(registry);
  }

  return imported;
}

/**
 * Ensure screenshot directories exist
 */
function ensureDirs() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Generate a unique screenshot ID
 * @returns {string} Screenshot ID
 */
function generateId() {
  return 'scr_' + crypto.randomBytes(8).toString('hex');
}

/**
 * Generate a unique upload ID
 * @returns {string} Upload ID
 */
function generateUploadId() {
  return 'img_' + crypto.randomBytes(8).toString('hex');
}

/**
 * Get screenshot path by ID
 * @param {string} id - Screenshot ID
 * @returns {string} Full path to screenshot file
 */
function getScreenshotPath(id) {
  return path.join(SCREENSHOTS_DIR, `${id}.png`);
}

/**
 * Get upload path by ID
 * @param {string} id - Upload ID
 * @param {string} ext - File extension
 * @returns {string} Full path to upload file
 */
function getUploadPath(id, ext = 'jpg') {
  return path.join(UPLOADS_DIR, `${id}.${ext}`);
}

/**
 * Save a screenshot from buffer
 * @param {Buffer} buffer - PNG image buffer
 * @returns {object} Screenshot metadata
 */
function saveScreenshot(buffer) {
  ensureDirs();

  const id = generateId();
  const filePath = getScreenshotPath(id);

  fs.writeFileSync(filePath, buffer);

  const stats = fs.statSync(filePath);

  // Cleanup old screenshots
  cleanupScreenshots();

  return {
    id,
    path: filePath,
    size: stats.size,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Save a screenshot from file path (copy)
 * @param {string} sourcePath - Source file path
 * @returns {object} Screenshot metadata
 */
function saveScreenshotFromFile(sourcePath) {
  ensureDirs();

  const id = generateId();
  const filePath = getScreenshotPath(id);

  fs.copyFileSync(sourcePath, filePath);

  const stats = fs.statSync(filePath);

  // Cleanup old screenshots
  cleanupScreenshots();

  return {
    id,
    path: filePath,
    size: stats.size,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get screenshot by ID
 * @param {string} id - Screenshot ID
 * @returns {Buffer|null} Screenshot buffer or null if not found
 */
function getScreenshot(id) {
  const filePath = getScreenshotPath(id);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath);
}

/**
 * Get latest screenshot
 * @returns {object|null} Latest screenshot metadata or null
 */
function getLatestScreenshot() {
  ensureDirs();

  const files = fs.readdirSync(SCREENSHOTS_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      name: f,
      id: f.replace('.png', ''),
      path: path.join(SCREENSHOTS_DIR, f),
      mtime: fs.statSync(path.join(SCREENSHOTS_DIR, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    return null;
  }

  const latest = files[0];
  const stats = fs.statSync(latest.path);

  return {
    id: latest.id,
    path: latest.path,
    size: stats.size,
    timestamp: stats.mtime.toISOString(),
  };
}

/**
 * List all screenshots
 * @returns {Array} List of screenshot metadata
 */
function listScreenshots() {
  ensureDirs();

  const files = fs.readdirSync(SCREENSHOTS_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => {
      const filePath = path.join(SCREENSHOTS_DIR, f);
      const stats = fs.statSync(filePath);
      return {
        id: f.replace('.png', ''),
        path: filePath,
        size: stats.size,
        timestamp: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return files;
}

/**
 * Delete a screenshot
 * @param {string} id - Screenshot ID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteScreenshot(id) {
  const filePath = getScreenshotPath(id);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Cleanup old screenshots (enforce limits)
 */
function cleanupScreenshots() {
  const screenshots = listScreenshots();
  const now = Date.now();

  // Remove screenshots exceeding max count
  if (screenshots.length > config.maxScreenshots) {
    const toRemove = screenshots.slice(config.maxScreenshots);
    toRemove.forEach(s => {
      try {
        fs.unlinkSync(s.path);
      } catch (err) {
        console.error('Error deleting screenshot:', err.message);
      }
    });
  }

  // Remove screenshots older than max age
  screenshots.forEach(s => {
    const age = now - new Date(s.timestamp).getTime();
    if (age > config.maxAge) {
      try {
        fs.unlinkSync(s.path);
      } catch (err) {
        console.error('Error deleting old screenshot:', err.message);
      }
    }
  });
}

/**
 * Save an uploaded image
 * @param {Buffer} buffer - Image buffer
 * @param {string} originalName - Original filename
 * @returns {object} Upload metadata
 */
function saveUpload(buffer, originalName) {
  ensureDirs();

  if (buffer.length > config.maxUploadSize) {
    throw new Error(`File too large. Maximum size is ${config.maxUploadSize / 1024 / 1024}MB`);
  }

  const ext = path.extname(originalName).slice(1) || 'jpg';
  const id = generateUploadId();
  const filePath = getUploadPath(id, ext);

  fs.writeFileSync(filePath, buffer);

  const stats = fs.statSync(filePath);

  return {
    id,
    path: filePath,
    size: stats.size,
    originalName,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get upload by ID
 * @param {string} id - Upload ID
 * @returns {object|null} Upload info or null if not found
 */
function getUpload(id) {
  ensureDirs();

  // Find file with any extension
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => f.startsWith(id));

  if (files.length === 0) {
    return null;
  }

  const fileName = files[0];
  const filePath = path.join(UPLOADS_DIR, fileName);
  const stats = fs.statSync(filePath);

  return {
    id,
    path: filePath,
    size: stats.size,
    timestamp: stats.mtime.toISOString(),
  };
}

/**
 * List all uploads
 * @returns {Array} List of upload metadata
 */
function listUploads() {
  ensureDirs();

  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => f.startsWith('img_'))
    .map(f => {
      const filePath = path.join(UPLOADS_DIR, f);
      const stats = fs.statSync(filePath);
      const id = f.split('.')[0];
      return {
        id,
        path: filePath,
        size: stats.size,
        timestamp: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return files;
}

/**
 * Delete an upload
 * @param {string} id - Upload ID
 * @returns {boolean} True if deleted
 */
function deleteUpload(id) {
  const upload = getUpload(id);
  if (!upload) {
    return false;
  }

  fs.unlinkSync(upload.path);
  return true;
}

module.exports = {
  SCREENSHOTS_DIR,
  UPLOADS_DIR,
  config,
  generateId,
  generateUploadId,
  getScreenshotPath,
  getUploadPath,
  saveScreenshot,
  saveScreenshotFromFile,
  getScreenshot,
  getLatestScreenshot,
  listScreenshots,
  deleteScreenshot,
  cleanupScreenshots,
  saveUpload,
  getUpload,
  listUploads,
  deleteUpload,
  importFromSources,
};
