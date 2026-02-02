# Remote Bridge Plugin - Technical Documentation

## Overview

**Remote Bridge** is a Claude Code plugin that enables remote control from mobile devices. It provides a real-time communication bridge between the mobile app and Claude Code via HTTP REST and WebSocket.

For detailed documentation, see the [Documentation Index](INDEX.md).

## Quick Reference

### Skills

| Skill | Command | Description |
|-------|---------|-------------|
| Start | `/remote-bridge:start` | Start server, show QR code |
| Stop | `/remote-bridge:stop` | Stop the server |
| Status | `/remote-bridge:status` | Show server status |
| Inbox | `/remote-bridge:inbox` | Review pending commands |

See [Skills Documentation](SKILLS.md) for details.

### Hooks

| Hook | Purpose |
|------|---------|
| SessionStart | Auto-start server on session begin |
| SessionEnd | Auto-stop server on session end |
| PostToolUse | Notify mobile app of tool activity |

See [Hooks Documentation](HOOKS.md) for details.

### Statusline

The plugin displays a statusline showing:
- Connection status (waiting/connected)
- Message counters (↑ sent ↓ received)
- Connected device name

See [Statusline Documentation](STATUSLINE.md) for details.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│  Plugin Server  │────▶│   Claude Code   │
│  (Ionic/Angular)│ WS  │    (Node.js)    │hooks│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Components:**
- **Mobile App** - Ionic/Angular companion app
- **Plugin Server** - Express + WebSocket server with localtunnel
- **Hooks & Skills** - Claude Code integration

See [Architecture Documentation](ARCHITECTURE.md) for full details.

## Key Concepts

### Command Queue

Commands from mobile are queued (not executed directly) for safety:

1. User sends command from mobile app
2. Command stored in `~/.claude/remote-bridge/commands.json`
3. User reviews via `/remote-bridge:inbox`
4. Claude executes approved commands

See [Command Queue Documentation](COMMAND-QUEUE.md) for details.

### Mode Switching

Toggle Claude Code modes from mobile app:
- **Plan Mode** - Claude plans before coding
- **Auto-accept** - Automatically accept tool executions

See [Modes Documentation](MODES.md) for details.

### Output Capture

Terminal output is captured and streamed to mobile:

1. Output written to `~/.claude/remote-bridge/output.log`
2. OutputWatcher polls for changes
3. New content broadcast via WebSocket

See [Output Capture Documentation](OUTPUT-CAPTURE.md) for details.

## State Files

All state in `~/.claude/remote-bridge/`:

| File | Purpose |
|------|---------|
| `state.json` | Server state, connection info |
| `metrics.json` | Message counters |
| `commands.json` | Command queue |
| `output.log` | Terminal output |

## API Overview

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/status` | Broadcast status |
| POST | `/shell/exec` | Execute command |
| POST | `/shell/type` | Type in terminal |
| POST | `/commands` | Queue command |
| GET | `/commands` | List commands |
| GET | `/modes` | Get mode state |
| POST | `/modes/toggle` | Toggle mode |

See [API Reference](API.md) for full documentation.

### WebSocket Messages

**Server → Client:**
- `connected` - Connection established
- `claude.status` - Status update
- `claude.output` - Terminal output
- `claude.activity` - Tool usage
- `command.added` - New command queued

**Client → Server:**
- `ping` - Heartbeat
- `broadcast` - Broadcast to clients

## Project Structure

```
remote-bridge-plugin/
├── .claude-plugin/
│   ├── plugin.json        # Plugin manifest
│   └── marketplace.json   # Marketplace metadata
├── skill/
│   ├── server.js          # Main server
│   ├── handlers/          # HTTP handlers
│   └── utils/             # Utilities
├── scripts/
│   ├── start-server.js    # SessionStart hook
│   ├── stop-server.js     # SessionEnd hook
│   ├── post-tool-hook.js  # PostToolUse hook
│   └── statusline.sh      # Statusline script
├── skills/
│   ├── start/             # Start skill
│   ├── stop/              # Stop skill
│   ├── status/            # Status skill
│   └── inbox/             # Inbox skill
└── docs/
    ├── INDEX.md           # Documentation index
    ├── CLAUDE.md          # This file
    ├── API.md             # API reference
    └── ...                # Other docs
```

## Common Tasks

### Start Remote Bridge

```
/remote-bridge:start
```

Then scan QR code with mobile app.

### Check Connection Status

```
/remote-bridge:status
```

### Process Mobile Commands

```
/remote-bridge:inbox
```

### Stop Remote Bridge

```
/remote-bridge:stop
```

## Troubleshooting

### Server Not Starting

1. Check if port 3000 is available
2. Verify node_modules installed: `cd skill && npm install`
3. Check logs: `tail -f /tmp/remote-bridge.log`

### Mobile Can't Connect

1. Verify tunnel URL in state: `cat ~/.claude/remote-bridge/state.json`
2. Check API key matches
3. Try localtunnel bypass in browser

### No Output in App

1. Check output watcher: `grep OutputWatcher /tmp/remote-bridge.log`
2. Verify WebSocket connected
3. Check output.log is being written

See [Debugging Guide](DEBUGGING.md) for more help.

## Related Documentation

| Document | Description |
|----------|-------------|
| [Index](INDEX.md) | Documentation index |
| [Architecture](ARCHITECTURE.md) | System design |
| [API Reference](API.md) | HTTP & WebSocket API |
| [Hooks](HOOKS.md) | Hook documentation |
| [Skills](SKILLS.md) | Skill reference |
| [Security](SECURITY.md) | Security guide |
| [Debugging](DEBUGGING.md) | Troubleshooting |
