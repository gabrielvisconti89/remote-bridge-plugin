# Remote Bridge Architecture

This document describes the technical architecture of the Remote Bridge Plugin system.

## System Overview

Remote Bridge enables remote control of Claude Code from mobile devices through a real-time communication bridge. The system consists of three main components:

1. **Plugin Server** - Node.js server running alongside Claude Code
2. **Mobile App** - Ionic/Angular companion app
3. **Claude Code Integration** - Hooks and skills for Claude Code integration

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MOBILE DEVICE                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Remote Bridge App                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐│  │
│  │  │ Connection  │  │    Chat     │  │      Settings               ││  │
│  │  │   Manager   │  │   Module    │  │       Module                ││  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────────────────────┘│  │
│  │         │                │                                         │  │
│  │         └────────────────┼─────────────────────────────────────────│  │
│  │                          ▼                                         │  │
│  │  ┌───────────────────────────────────────────────────────────────┐│  │
│  │  │                    Core Services                              ││  │
│  │  │  ApiService │ WebSocketService │ StorageService │ ModesService││  │
│  │  └───────────────────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                      HTTP REST     │     WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTERNET / LAN                                   │
│                    (Localtunnel / SSH Tunnel)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPER MACHINE                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Plugin Server (Node.js)                        │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                     EXPRESS APP                              │  │  │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │  │  │
│  │  │  │  CORS   │  │ API Key │  │ Logger  │  │ Handlers │       │  │  │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                   WEBSOCKET SERVER                          │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │  │
│  │  │  │  Clients    │  │  Heartbeat  │  │  Broadcast  │        │  │  │
│  │  │  │    Map      │  │   Manager   │  │   Manager   │        │  │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                      UTILITIES                               │  │  │
│  │  │  ┌─────────┐  ┌─────────────┐  ┌─────────────┐             │  │  │
│  │  │  │  State  │  │ CommandQueue│  │OutputWatcher│             │  │  │
│  │  │  │ Manager │  │             │  │             │             │  │  │
│  │  │  └─────────┘  └─────────────┘  └─────────────┘             │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        CLAUDE CODE                                │  │
│  │  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌───────────┐         │  │
│  │  │ Session │  │ Session │  │ PostTool  │  │ Statusline│         │  │
│  │  │  Start  │  │   End   │  │   Use     │  │           │         │  │
│  │  └─────────┘  └─────────┘  └───────────┘  └───────────┘         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## State Files

All state is persisted in `~/.claude/remote-bridge/`:

### state.json

Main server state file containing:

```json
{
  "enabled": true,
  "pid": 12345,
  "url": "https://xxx.loca.lt",
  "apiKey": "abc123...",
  "connected": true,
  "connectedDevice": "iPhone 15",
  "startedAt": "2026-02-02T12:00:00.000Z",
  "modes": {
    "plan": false,
    "autoAccept": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Server is running |
| `pid` | number | Server process ID |
| `url` | string | Public tunnel URL |
| `apiKey` | string | Authentication key |
| `connected` | boolean | App is connected |
| `connectedDevice` | string | Connected device name |
| `startedAt` | string | Server start timestamp |
| `modes.plan` | boolean | Plan mode active |
| `modes.autoAccept` | boolean | Auto-accept mode active |

### metrics.json

Message counters and activity tracking:

```json
{
  "sent": 150,
  "received": 75,
  "lastActivity": "2026-02-02T12:30:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sent` | number | Messages sent to app |
| `received` | number | Messages received from app |
| `lastActivity` | string | Last activity timestamp |

### commands.json

Command queue for the inbox system:

```json
{
  "queue": [
    {
      "id": "cmd_abc123",
      "command": "git status",
      "receivedAt": "2026-02-02T12:00:00.000Z",
      "from": "iPhone 15",
      "status": "pending"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique command ID |
| `command` | string | Command text |
| `receivedAt` | string | Received timestamp |
| `from` | string | Source device name |
| `status` | string | `pending`, `executed`, `dismissed` |

### output.log

Raw terminal output captured from Claude Code (used by OutputWatcher).

## Data Flow

### 1. Command Execution Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Mobile  │────▶│  Server  │────▶│  Queue   │────▶│  Claude  │
│   App    │     │   API    │     │ (inbox)  │     │   Code   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                    │
     │◀───────────────────────────────────────────────────│
                    Output via WebSocket
```

1. User types command in mobile app
2. App sends command to server via HTTP POST
3. Command queued in `commands.json`
4. User runs `/inbox` skill in Claude Code
5. Claude reviews and executes command
6. Output captured and sent to app via WebSocket

### 2. Real-time Output Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Claude  │────▶│  Output  │────▶│  Server  │────▶│  Mobile  │
│   Code   │     │  Watcher │     │  (WS)    │     │   App    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

1. Claude Code writes to terminal
2. OutputWatcher polls `output.log` file
3. New content detected and cleaned (ANSI codes removed)
4. Content broadcast to connected WebSocket clients

### 3. Activity Notification Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Claude  │────▶│ PostTool │────▶│  Server  │────▶│  Mobile  │
│   Code   │     │   Hook   │     │   API    │     │   App    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

1. Claude Code uses a tool (Bash, Edit, etc.)
2. PostToolUse hook fires, script runs
3. Script sends activity info to server
4. Server broadcasts to connected clients

## Server Components

### Express App

HTTP server with the following middleware stack:

1. **CORS** - Allows all origins (required for mobile app)
2. **JSON Parser** - 10MB limit for large payloads
3. **HTTP Logger** - Request/response logging
4. **API Key Auth** - Validates `X-API-Key` header

### WebSocket Server

Real-time communication with:

- **Client Management** - Track connected clients with IDs
- **Heartbeat** - 30s ping interval to detect disconnections
- **Authentication** - API key via query parameter
- **Broadcast** - Send messages to all/selected clients

### Route Handlers

| Handler | Routes | Purpose |
|---------|--------|---------|
| `shell.js` | `/shell/*` | Command execution, typing |
| `file.js` | `/file/*` | File operations |
| `system.js` | `/system/*` | System information |
| `modes.js` | `/modes/*` | Mode toggle |
| `commands.js` | `/commands/*` | Command queue |

### Utilities

| Utility | File | Purpose |
|---------|------|---------|
| State Manager | `utils/state.js` | Read/write state.json |
| Command Queue | `utils/commandQueue.js` | Manage command queue |
| Output Watcher | `utils/outputWatcher.js` | Monitor terminal output |
| Config | `utils/config.js` | Load configuration |
| Logger | `utils/logger.js` | Winston-based logging |

## Plugin Integration

### Hooks

The plugin registers three hooks with Claude Code:

| Hook | Script | Purpose |
|------|--------|---------|
| SessionStart | `scripts/start-server.js` | Start server on session start |
| SessionEnd | `scripts/stop-server.js` | Stop server on session end |
| PostToolUse | `scripts/post-tool-hook.js` | Notify app of tool usage |

### Skills

Four skills are provided for manual control:

| Skill | Path | Purpose |
|-------|------|---------|
| `/start` | `skills/start/` | Start server and show QR code |
| `/stop` | `skills/stop/` | Stop server |
| `/status` | `skills/status/` | Show server status |
| `/inbox` | `skills/inbox/` | View and execute pending commands |

### Statusline

The plugin provides a statusline script that displays:

- Connection status (waiting/connected)
- Message counters (↑ sent ↓ received)
- Connected device name

## Security Model

### Authentication

- **API Key** - Auto-generated 32-character hex string
- **HTTP** - Validated via `X-API-Key` header
- **WebSocket** - Validated via `?key=` query parameter

### Command Safety

Commands from mobile are not executed directly. They are:

1. Queued in `commands.json`
2. Reviewed by user via `/inbox` skill
3. Executed only with explicit approval

See [Security](SECURITY.md) for more details.

## Network Architecture

### Local Access

Direct connection via local IP:

```
App → http://192.168.1.100:3000 → Server
```

### Remote Access (Localtunnel)

Public tunnel via localtunnel service:

```
App → https://xxx.loca.lt → Localtunnel → Server
```

### Remote Access (SSH Tunnel)

Alternative using SSH reverse tunnel:

```
App → your-server.com:443 → SSH Tunnel → Server
```

See [Tunneling](TUNNELING.md) for configuration details.
