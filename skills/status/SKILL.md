---
name: status
description: Show detailed Remote Bridge server status
---

# Remote Bridge Status

This skill shows the current status of the Remote Bridge server.

## What It Does

1. Reads the state file from `~/.claude/remote-bridge/state.json`
2. Reads metrics from `~/.claude/remote-bridge/metrics.json`
3. Displays detailed status information

## Instructions

Execute the following:

### Step 1: Check Status

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/show-status.js"
```

### Step 2: Display Status to User

Based on the output, tell the user the current status:

**If server is running and connected:**
> **Remote Bridge Status**
> - Server: Running
> - URL: [public URL]
> - Connection: Connected
> - Device: [device name]
> - Messages: [sent] sent / [received] received
> - Uptime: [time since start]

**If server is running but not connected:**
> **Remote Bridge Status**
> - Server: Running
> - URL: [public URL]
> - Connection: Waiting for app...
> - Scan the QR code with `/remote-bridge:start` to connect

**If server is not running:**
> **Remote Bridge Status**
> - Server: Not running
> - Use `/remote-bridge:start` to start the server
