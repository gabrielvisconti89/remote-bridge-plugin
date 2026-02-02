# Output Capture

Remote Bridge captures Claude Code terminal output and streams it to the mobile app in real-time.

## Overview

The OutputWatcher monitors a log file that captures Claude Code's terminal output, then broadcasts new content to connected mobile clients via WebSocket.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │────▶│  Terminal   │────▶│   Output    │────▶│   Server    │
│    Code     │     │   (TTY)     │     │   Watcher   │     │  (WebSocket)│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                    │                   │
                           ▼                    │                   ▼
                    ┌─────────────┐             │            ┌─────────────┐
                    │ output.log  │◀────────────┘            │   Mobile    │
                    │   (file)    │                          │    App      │
                    └─────────────┘                          └─────────────┘
```

## How It Works

### 1. Output Logging

Claude Code terminal output is captured to a log file:

- **Location:** `~/.claude/remote-bridge/output.log`
- **Method:** Terminal output redirection or tee

### 2. File Polling

The OutputWatcher polls the log file for changes:

```javascript
class OutputWatcher extends EventEmitter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || OUTPUT_FILE;
    this.pollInterval = options.pollInterval || 1000; // 1 second
    this.lastSize = 0;
  }

  checkForChanges() {
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
  }
}
```

### 3. Content Processing

New content is cleaned and filtered:

```javascript
processContent(content) {
  const lines = content.split('\n');

  for (const line of lines) {
    // Clean ANSI escape codes
    const cleanLine = this.cleanAnsiCodes(line).trim();

    // Skip empty lines
    if (!cleanLine) continue;

    // Skip prompt lines
    if (this.isPromptLine(cleanLine)) continue;

    // Emit the cleaned output
    this.emit('output', cleanLine);
  }
}
```

### 4. WebSocket Broadcast

Clean output is broadcast to all connected clients:

```javascript
outputWatcher.on('output', (line) => {
  const message = JSON.stringify({
    type: 'claude.output',
    content: line,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    if (client.ws.readyState === 1) {
      client.ws.send(message);
    }
  });
});
```

## Configuration

### Poll Interval

Default: 1000ms (1 second)

The poll interval can be adjusted in `OutputWatcher` constructor:

```javascript
const outputWatcher = new OutputWatcher({
  pollInterval: 500 // Check every 500ms
});
```

### Output File Location

Default: `~/.claude/remote-bridge/output.log`

```javascript
const outputWatcher = new OutputWatcher({
  outputFile: '/custom/path/output.log'
});
```

## ANSI Code Cleaning

Terminal output often contains ANSI escape codes for colors, cursor movement, etc. These are stripped:

```javascript
cleanAnsiCodes(str) {
  return str
    // ANSI escape sequences (colors, cursor)
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    // OSC sequences (window title, etc.)
    .replace(/\x1B\].*?\x07/g, '')
    // Other sequences
    .replace(/\x1B[PX^_].*?\x1B\\/g, '')
    // Control characters (except newline)
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '');
}
```

## Prompt Filtering

Common prompt patterns are skipped to avoid clutter:

```javascript
isPromptLine(line) {
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
```

## WebSocket Message Format

Output messages sent to mobile app:

```json
{
  "type": "claude.output",
  "content": "Successfully compiled 42 files",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

## API Endpoints

### DELETE /claude/output

Clear the output log file.

**Request:**
```bash
curl -X DELETE http://localhost:3000/claude/output \
  -H "X-API-Key: {api-key}"
```

**Response:**
```json
{
  "success": true,
  "message": "Output log cleared"
}
```

## File Locations

| File | Path | Description |
|------|------|-------------|
| Output Log | `~/.claude/remote-bridge/output.log` | Captured terminal output |

## Usage in Server

The OutputWatcher is started when the server starts:

```javascript
// server.js
const { OutputWatcher } = require('./utils/outputWatcher');

const outputWatcher = new OutputWatcher();
outputWatcher.start();

outputWatcher.on('output', (line) => {
  // Broadcast to clients...
});

outputWatcher.on('error', (err) => {
  logger.error('Output watcher error', { error: err.message });
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  outputWatcher.stop();
});
```

## Mobile App Display

The mobile app displays output in the chat interface:

```
┌─────────────────────────────────────┐
│ 🤖 Claude                           │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Running git status...           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ On branch main                  │ │
│ │ Your branch is up to date with  │ │
│ │ 'origin/main'.                  │ │
│ │                                 │ │
│ │ Changes not staged for commit:  │ │
│ │   modified: src/app.ts          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Limitations

### Log File Dependency

Output capture requires the log file to be written by Claude Code. If Claude Code doesn't write to the log file, no output will be captured.

### Polling Latency

File polling introduces latency (default 1 second). Real-time streaming would require:
- PTY integration
- Named pipes
- Direct terminal access

### Large Output

Very large output may cause performance issues. Consider:
- Limiting lines per broadcast
- Throttling broadcasts
- Truncating long lines

## Troubleshooting

### No Output Captured

1. Check if log file exists: `ls -la ~/.claude/remote-bridge/output.log`
2. Verify file is being written to: `tail -f ~/.claude/remote-bridge/output.log`
3. Check server logs for watcher errors

### Garbled Output

1. ANSI codes not being cleaned properly
2. Character encoding issues
3. Add custom cleaning patterns if needed

### Missing Lines

1. Poll interval too long
2. File truncated between polls
3. Lines filtered as prompts

## See Also

- [Architecture](ARCHITECTURE.md) - System design
- [WebSocket API](API.md#websocket-api) - Message formats
- [Debugging](DEBUGGING.md) - Troubleshooting guide
