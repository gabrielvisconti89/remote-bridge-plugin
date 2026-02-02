# Remote Bridge Plugin Documentation

Welcome to the Remote Bridge Plugin documentation. This plugin enables remote control of Claude Code from mobile devices via a companion mobile app.

## Quick Links

| Document | Description |
|----------|-------------|
| [README](../README.md) | Quick start guide and installation |
| [CLAUDE.md](CLAUDE.md) | Technical overview for AI assistants |
| [API Reference](API.md) | HTTP & WebSocket API documentation |

## Architecture & Design

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System design, state files, data flow |
| [Hooks](HOOKS.md) | SessionStart, SessionEnd, PostToolUse hooks |
| [Skills](SKILLS.md) | Skills reference (/start, /stop, /status, /inbox) |

## Features

| Document | Description |
|----------|-------------|
| [Command Queue](COMMAND-QUEUE.md) | Safe command queue system ("inbox") |
| [Modes](MODES.md) | Plan mode and Auto-accept mode switching |
| [Output Capture](OUTPUT-CAPTURE.md) | Terminal output monitoring via file polling |
| [Statusline](STATUSLINE.md) | Statusline configuration and display format |

## Connectivity

| Document | Description |
|----------|-------------|
| [Tunneling](TUNNELING.md) | Localtunnel & SSH reverse tunnel options |

## Advanced Topics

| Document | Description |
|----------|-------------|
| [Playwright](PLAYWRIGHT.md) | Screenshot integration with Playwright MCP |
| [Security](SECURITY.md) | API key auth, command review, network security |
| [Debugging](DEBUGGING.md) | Troubleshooting and log file locations |
| [Privacy](PRIVACY.md) | Data handling and privacy policy |

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (Ionic/Angular)                  │
│     Connections │ Chat │ Skills │ Settings                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP REST │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PLUGIN SERVER (Node.js)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │   Express   │  │  WebSocket │  │ Localtunnel │               │
│  │   (HTTP)    │  │   Server   │  │  (Tunnel)   │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │   State    │  │  Command   │  │   Output    │               │
│  │  Manager   │  │   Queue    │  │  Watcher    │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Hooks & Skills
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CLAUDE CODE                               │
│  SessionStart │ SessionEnd │ PostToolUse │ Statusline          │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

### Plugin Configuration
- `.claude-plugin/plugin.json` - Plugin manifest and hooks
- `.claude-plugin/marketplace.json` - Marketplace metadata

### Server
- `skill/server.js` - Main Express + WebSocket server
- `skill/handlers/` - HTTP route handlers
- `skill/utils/` - Utilities (state, config, logging)

### Scripts
- `scripts/start-server.js` - SessionStart hook script
- `scripts/stop-server.js` - SessionEnd hook script
- `scripts/post-tool-hook.js` - PostToolUse hook script
- `scripts/statusline.sh` - Statusline display script

### Skills
- `skills/start/` - Start server and show QR code
- `skills/stop/` - Stop server
- `skills/status/` - Show server status
- `skills/inbox/` - View and execute pending commands
