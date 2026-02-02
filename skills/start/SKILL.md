---
name: start
description: Start Remote Bridge server and display QR code for mobile app connection
---

# Remote Bridge Start

This skill starts the Remote Bridge server and displays a QR code for easy mobile app connection.

## What It Does

1. Checks if server is already running
2. Starts the Node.js server with localtunnel
3. Saves connection state to `~/.claude/remote-bridge/state.json`
4. Displays QR code containing connection URL and API key
5. Configures statusline to show connection status

## Instructions

Execute the following steps:

### Step 1: Start the Server

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/start-server.js"
```

### Step 2: Display QR Code

After the server starts, display the QR code:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/show-qrcode.js"
```

### Step 3: Configure Statusline

The statusline will automatically be configured to show:
- Connection status (waiting/connected)
- Message counters when connected
- Device name when connected

## User Feedback

Tell the user:

> Remote Bridge server started! Scan the QR code above with the Remote Bridge mobile app to connect.
>
> The statusline will show connection status. When the app connects, it will display the device name and message counters.
>
> To stop the server, use `/remote-bridge:stop`
