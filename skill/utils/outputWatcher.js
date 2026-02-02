const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

// Output log file location
const OUTPUT_DIR = path.join(os.homedir(), '.claude', 'remote-bridge');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'output.log');

/**
 * OutputWatcher - Monitors Claude Code terminal output log file
 * and emits events when new content is detected.
 */
class OutputWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.outputFile = options.outputFile || OUTPUT_FILE;
    this.pollInterval = options.pollInterval || 1000; // 1 second default
    this.lastSize = 0;
    this.intervalHandle = null;
    this.isRunning = false;
  }

  /**
   * Start watching the output file
   */
  start() {
    if (this.isRunning) {
      return;
    }

    // Ensure directory exists
    const dir = path.dirname(this.outputFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create file if it doesn't exist
    if (!fs.existsSync(this.outputFile)) {
      fs.writeFileSync(this.outputFile, '');
    }

    // Get initial file size
    try {
      this.lastSize = fs.statSync(this.outputFile).size;
    } catch (err) {
      this.lastSize = 0;
    }

    // Start polling for changes
    this.intervalHandle = setInterval(() => this.checkForChanges(), this.pollInterval);
    this.isRunning = true;

    console.log(`[OutputWatcher] Watching ${this.outputFile}`);
    this.emit('started', { file: this.outputFile });
  }

  /**
   * Check for new content in the output file
   */
  checkForChanges() {
    try {
      const stat = fs.statSync(this.outputFile);

      // File was truncated or reset
      if (stat.size < this.lastSize) {
        this.lastSize = 0;
      }

      // New content available
      if (stat.size > this.lastSize) {
        const newBytes = stat.size - this.lastSize;
        const buffer = Buffer.alloc(newBytes);

        const fd = fs.openSync(this.outputFile, 'r');
        fs.readSync(fd, buffer, 0, newBytes, this.lastSize);
        fs.closeSync(fd);

        this.lastSize = stat.size;

        const newContent = buffer.toString('utf8');
        this.processContent(newContent);
      }
    } catch (err) {
      // File might not exist yet or be temporarily unavailable
      if (err.code !== 'ENOENT') {
        this.emit('error', err);
      }
    }
  }

  /**
   * Process new content from the log file
   * @param {string} content - New content to process
   */
  processContent(content) {
    // Split into lines and process each
    const lines = content.split('\n');

    for (const line of lines) {
      // Clean ANSI escape codes
      const cleanLine = this.cleanAnsiCodes(line).trim();

      // Skip empty lines
      if (!cleanLine) {
        continue;
      }

      // Skip prompt lines (user input indicators)
      if (this.isPromptLine(cleanLine)) {
        continue;
      }

      // Emit the cleaned output line
      this.emit('output', cleanLine);
    }
  }

  /**
   * Remove ANSI escape codes from a string
   * @param {string} str - String with potential ANSI codes
   * @returns {string} Clean string
   */
  cleanAnsiCodes(str) {
    // Remove ANSI escape sequences (colors, cursor movement, etc.)
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
              .replace(/\x1B\].*?\x07/g, '')  // OSC sequences
              .replace(/\x1B[PX^_].*?\x1B\\/g, '')  // Other sequences
              .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '');  // Control chars except \n
  }

  /**
   * Check if a line is a prompt line (should be skipped)
   * @param {string} line - Line to check
   * @returns {boolean} True if it's a prompt line
   */
  isPromptLine(line) {
    // Skip common prompt patterns
    const promptPatterns = [
      /^>\s*$/,           // Just >
      /^claude>\s*/i,     // claude> prompt
      /^\$\s*$/,          // $ prompt
      /^%\s*$/,           // % prompt
      /^>>>\s*$/,         // >>> prompt
      /^\.\.\.\s*$/,      // ... continuation
    ];

    return promptPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Stop watching the output file
   */
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    console.log('[OutputWatcher] Stopped');
    this.emit('stopped');
  }

  /**
   * Clear the output log file
   */
  clearLog() {
    try {
      fs.writeFileSync(this.outputFile, '');
      this.lastSize = 0;
      console.log('[OutputWatcher] Log cleared');
    } catch (err) {
      this.emit('error', err);
    }
  }
}

module.exports = {
  OutputWatcher,
  OUTPUT_FILE,
  OUTPUT_DIR,
};
