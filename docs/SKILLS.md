# Remote Bridge Skills

Skills provide manual control over the Remote Bridge server from within Claude Code.

## Overview

Four skills are available:

| Skill | Command | Description |
|-------|---------|-------------|
| Start | `/remote-bridge:start` | Start server and display QR code |
| Stop | `/remote-bridge:stop` | Stop the server |
| Status | `/remote-bridge:status` | Show server status |
| Inbox | `/remote-bridge:inbox` | View and execute pending commands |

## /remote-bridge:start

Starts the Remote Bridge server and displays a QR code for mobile app connection.

### Usage

```
/remote-bridge:start
```

### What It Does

1. Checks if server is already running
2. Starts the Node.js server with localtunnel
3. Saves connection state to `~/.claude/remote-bridge/state.json`
4. Displays QR code containing connection URL and API key
5. Configures statusline to show connection status

### Steps Executed

```bash
# Step 1: Start the server
"${CLAUDE_PLUGIN_ROOT}/scripts/start-server.js"

# Step 2: Display QR code
"${CLAUDE_PLUGIN_ROOT}/scripts/show-qrcode.js"
```

### Output Example

```
============================================================
           REMOTE BRIDGE - Connection Info
============================================================
  Public URL:  https://abc-def-123.loca.lt
  API Key:     a1b2c3d4e5f6...
  Local:       http://localhost:3000
============================================================

[QR CODE DISPLAYED HERE]

Scan the QR code with the Remote Bridge mobile app to connect.
```

### User Feedback

After starting, Claude will inform the user:

> Remote Bridge server started! Scan the QR code above with the Remote Bridge mobile app to connect.
>
> The statusline will show connection status. When the app connects, it will display the device name and message counters.
>
> To stop the server, use `/remote-bridge:stop`

## /remote-bridge:stop

Stops the Remote Bridge server.

### Usage

```
/remote-bridge:stop
```

### What It Does

1. Reads the PID from `/tmp/remote-bridge.pid`
2. Sends SIGTERM to stop the server gracefully
3. Cleans up PID and log files
4. Clears connection state

### Steps Executed

```bash
# Stop the server
"${CLAUDE_PLUGIN_ROOT}/scripts/stop-server.js"
```

### Output Example

```
Remote Bridge server stopped.
```

### User Feedback

After stopping, Claude will inform the user:

> Remote Bridge server has been stopped. The mobile app will disconnect.
>
> To start again, use `/remote-bridge:start`

## /remote-bridge:status

Shows the current status of the Remote Bridge server.

### Usage

```
/remote-bridge:status
```

### What It Does

1. Reads state from `~/.claude/remote-bridge/state.json`
2. Reads metrics from `~/.claude/remote-bridge/metrics.json`
3. Displays comprehensive status information
4. Shows connection details if connected

### Steps Executed

```bash
# Show status
"${CLAUDE_PLUGIN_ROOT}/scripts/show-status.js"
```

### Output Example (Server Running, Connected)

```
============================================================
                REMOTE BRIDGE STATUS
============================================================
  Server:      Running (PID: 12345)
  Started:     2026-02-02 12:00:00

  Connection:  Connected
  Device:      iPhone 15

  Public URL:  https://abc-def-123.loca.lt
  API Key:     a1b2c3d4e5f6... (tap to copy)

  Messages:
    Sent:      150
    Received:  75

  Modes:
    Plan Mode:       Off
    Auto-accept:     Off
============================================================
```

### Output Example (Server Not Running)

```
============================================================
                REMOTE BRIDGE STATUS
============================================================
  Server:      Not running

  Use /remote-bridge:start to start the server.
============================================================
```

## /remote-bridge:inbox

Views and executes pending commands from the mobile app.

### Usage

```
/remote-bridge:inbox
```

### What It Does

1. Reads command queue from `~/.claude/remote-bridge/commands.json`
2. Displays pending commands with details
3. Allows user to review before execution
4. Executes approved commands
5. Marks commands as executed or dismissed

### Steps Executed

```bash
# Show inbox
"${CLAUDE_PLUGIN_ROOT}/scripts/show-inbox.js"
```

### Output Example (With Pending Commands)

```
============================================================
                  COMMAND INBOX
============================================================
  3 pending commands from mobile app:

  [1] cmd_abc123 - 2026-02-02 12:00:00
      From: iPhone 15
      Command: git status

  [2] cmd_def456 - 2026-02-02 12:01:00
      From: iPhone 15
      Command: npm test

  [3] cmd_ghi789 - 2026-02-02 12:02:00
      From: iPhone 15
      Command: ls -la
============================================================

Review the commands above. Execute them one by one after
user approval.
```

### Output Example (Empty Inbox)

```
============================================================
                  COMMAND INBOX
============================================================
  No pending commands.

  Commands sent from the mobile app will appear here.
  Use /remote-bridge:inbox to check for new commands.
============================================================
```

### Command Execution Flow

When executing commands from the inbox:

1. Claude shows the command to the user
2. User approves or dismisses
3. If approved, Claude executes the command
4. Result is sent back to mobile app
5. Command marked as `executed` or `dismissed`

## Skill File Structure

Each skill is defined in its own directory:

```
skills/
├── start/
│   └── SKILL.md
├── stop/
│   └── SKILL.md
├── status/
│   └── SKILL.md
└── inbox/
    └── SKILL.md
```

### SKILL.md Format

```markdown
---
name: start
description: Start Remote Bridge server and display QR code
---

# Remote Bridge Start

This skill starts the Remote Bridge server...

## Instructions

Execute the following steps:

### Step 1: Start the Server

\`\`\`bash
"${CLAUDE_PLUGIN_ROOT}/scripts/start-server.js"
\`\`\`

...
```

## See Also

- [Hooks](HOOKS.md) - Automatic server management
- [Command Queue](COMMAND-QUEUE.md) - How the inbox works
- [Statusline](STATUSLINE.md) - Status display configuration
