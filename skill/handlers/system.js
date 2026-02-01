const os = require('os');
const { Router } = require('express');

const config = require('../utils/config');
const logger = require('../utils/logger');

const router = Router();

// Server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * GET /system/info
 * Get system information (CPU, memory, OS)
 */
router.get('/info', (req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  res.json({
    success: true,
    system: {
      platform: os.platform(),
      release: os.release(),
      type: os.type(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      uptimeFormatted: `${Math.floor(os.uptime() / 86400)}d ${Math.floor((os.uptime() % 86400) / 3600)}h`,
    },
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      speed: cpus[0]?.speed || 0,
    },
    memory: {
      total: totalMem,
      totalFormatted: formatBytes(totalMem),
      free: freeMem,
      freeFormatted: formatBytes(freeMem),
      used: usedMem,
      usedFormatted: formatBytes(usedMem),
      usagePercent: ((usedMem / totalMem) * 100).toFixed(2),
    },
    network: {
      interfaces: Object.keys(os.networkInterfaces()),
    },
    user: {
      username: os.userInfo().username,
      homedir: os.homedir(),
      tmpdir: os.tmpdir(),
    },
  });
});

/**
 * GET /system/status
 * Get server status
 */
router.get('/status', (req, res) => {
  const { clients } = require('../server');
  const uptime = Date.now() - serverStartTime;

  res.json({
    success: true,
    server: {
      status: 'running',
      uptime,
      uptimeFormatted: `${Math.floor(uptime / 86400000)}d ${Math.floor((uptime % 86400000) / 3600000)}h ${Math.floor((uptime % 3600000) / 60000)}m`,
      startTime: new Date(serverStartTime).toISOString(),
    },
    config: {
      port: config.port,
      host: config.host,
      logLevel: config.logLevel,
      maxFileSize: formatBytes(config.maxFileSize),
      commandTimeout: `${config.commandTimeout}ms`,
    },
    connections: {
      websocket: clients.size,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      memoryUsage: {
        heapUsed: formatBytes(process.memoryUsage().heapUsed),
        heapTotal: formatBytes(process.memoryUsage().heapTotal),
        rss: formatBytes(process.memoryUsage().rss),
      },
    },
  });
});

/**
 * GET /system/health
 * Health check endpoint (alias to /health)
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - serverStartTime,
  });
});

/**
 * GET /system/load
 * Get system load averages
 */
router.get('/load', (req, res) => {
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;

  res.json({
    success: true,
    load: {
      avg1: loadAvg[0].toFixed(2),
      avg5: loadAvg[1].toFixed(2),
      avg15: loadAvg[2].toFixed(2),
      cpuCount,
      normalized: {
        avg1: (loadAvg[0] / cpuCount).toFixed(2),
        avg5: (loadAvg[1] / cpuCount).toFixed(2),
        avg15: (loadAvg[2] / cpuCount).toFixed(2),
      },
    },
  });
});

/**
 * GET /system/env
 * Get environment variables (filtered for security)
 */
router.get('/env', (req, res) => {
  const { filter } = req.query;

  // Sensitive patterns to exclude
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /credential/i,
    /auth/i,
  ];

  const env = {};

  Object.entries(process.env).forEach(([key, value]) => {
    // Skip sensitive variables
    const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));
    if (isSensitive) {
      env[key] = '[REDACTED]';
      return;
    }

    // Apply filter if provided
    if (filter && !key.toLowerCase().includes(filter.toLowerCase())) {
      return;
    }

    env[key] = value;
  });

  res.json({
    success: true,
    count: Object.keys(env).length,
    env,
  });
});

/**
 * GET /system/network
 * Get network interfaces details
 */
router.get('/network', (req, res) => {
  const interfaces = os.networkInterfaces();
  const result = {};

  Object.entries(interfaces).forEach(([name, addrs]) => {
    result[name] = addrs.map((addr) => ({
      address: addr.address,
      family: addr.family,
      internal: addr.internal,
      mac: addr.mac,
      netmask: addr.netmask,
    }));
  });

  res.json({
    success: true,
    interfaces: result,
  });
});

module.exports = router;
