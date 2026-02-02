# Remote Bridge Plugin

Claude Code plugin for remote control from your mobile device.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-blue.svg)]()

## Overview

Remote Bridge is a Claude Code plugin that lets you control Claude Code from your mobile device or any WebSocket client. When you start the server, it displays a QR code and connection details that clients can use to connect instantly.

A companion mobile app is available for iOS and Android (see [Companion App](#companion-app) section).

## Quick Start

### 1. Start the Server
```
/remote-bridge:start
```

This displays a QR code in your terminal:

```
╭─────────────────────────────────────────────────────────────╮
│          🌐 Remote Bridge - Aguardando Conexão...           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│               ██████████  ██████████████                    │
│               ██      ██  ██          ██                    │
│               ██  ██████  ██  ██████  ██                    │
│               ██████████  ██████████████                    │
│                                                             │
│  Escaneie com o app Remote Bridge para conectar             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  URL: https://xxxxx.loca.lt                                 │
│  Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx                      │
╰─────────────────────────────────────────────────────────────╯
```

### 2. Connect with Mobile App
Open the Remote Bridge app and scan the QR code. The app will automatically connect.

### 3. Check the Statusline
Once connected, the statusline shows:
```
🌐 Remote Bridge: 🟢 Conectado | ↑ 5 ↓ 12 | 📱 iPhone de Gabriel
```

### 4. Stop the Server
```
/remote-bridge:stop
```

## Commands

| Command | Description |
|---------|-------------|
| `/remote-bridge:start` | Start server and display QR code |
| `/remote-bridge:stop` | Stop the server |
| `/remote-bridge:status` | Show detailed server status |

## Architecture

```
+-----------------+      HTTP/WS      +-----------------+      Local      +-----------------+
|   Mobile App    | <---------------> |  Plugin Server  | <-------------> |   Claude Code   |
|  (iOS/Android)  |                   |    (Node.js)    |                 |     (CLI)       |
+-----------------+                   +-----------------+                 +-----------------+
```

## Installation

### From Marketplace

**Step 1: Add the marketplace (one-time)**
```bash
claude plugin marketplace add gabrielvisconti89/remote-bridge-plugin
```

**Step 2: Install the plugin**
```bash
claude plugin install remote-bridge@remote-bridge-plugin
```

### Manual Installation

```bash
git clone https://github.com/gabrielvisconti89/remote-bridge-plugin.git
cd remote-bridge-plugin
./scripts/install.sh
```

## How It Works

1. **Start Command**: Use `/remote-bridge:start` to start the server and display QR code
2. **QR Code**: The QR contains connection URL and API key as JSON
3. **Mobile Scan**: The app scans the QR and connects automatically via WebSocket
4. **Statusline**: Shows connection status, message counters, and device name
5. **Stop Command**: Use `/remote-bridge:stop` to stop everything

### Connection Flow

```
User: /remote-bridge:start
    │
    ▼
┌─────────────────────────────────────┐
│ Server starts with localtunnel     │
│ QR code displayed in terminal      │
│ Statusline: "Aguardando..."        │
└─────────────────────────────────────┘
    │
    ▼
Mobile app scans QR code
    │
    ▼
App connects via WebSocket
    │
    ▼
┌─────────────────────────────────────┐
│ Statusline changes to:              │
│ 🟢 Conectado | ↑ 0 ↓ 0 | 📱 Device │
└─────────────────────────────────────┘
    │
    ▼
Messages flow, counters update in real-time
```

## Features

| Feature | Description |
|---------|-------------|
| **QR Code Connection** | Scan to connect instantly |
| **Real-time Statusline** | See connection status and message counters |
| **Remote Execution** | Run shell commands from your phone |
| **Typing Mode** | Type commands directly into the terminal |
| **WebSocket** | Real-time bidirectional communication |
| **Secure** | API key authentication |
| **Cross-platform** | Runs on macOS, Linux, Windows |
| **Auto Start/Stop** | Hooks for automatic lifecycle management |

## Configuration

Environment variables (set in `skill/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILL_PORT` | 3000 | HTTP/WebSocket port |
| `SKILL_HOST` | 0.0.0.0 | Bind address |
| `SKILL_API_KEY` | (auto-generated) | Authentication key |
| `SKILL_LOG_LEVEL` | info | Log verbosity |

## State Files

The plugin stores state in `~/.claude/remote-bridge/`:

| File | Description |
|------|-------------|
| `state.json` | Server state (enabled, URL, API key, connection status) |
| `metrics.json` | Message counters (sent, received) |

## Platform Notes

### macOS
Typing Mode uses AppleScript. No additional setup required.

### Linux
Install xdotool for Typing Mode:
```bash
sudo apt install xdotool
```

### Windows
Typing Mode uses PowerShell SendKeys. No additional setup required.

## Companion App

A mobile app is available for convenient access from your phone:

- **iOS**: Available on the App Store (search "Remote Bridge")
- **Android**: Coming soon

Alternatively, you can build your own client using the API documented below.

## Project Structure

```
remote-bridge-plugin/
├── .claude-plugin/     # Plugin manifest
├── scripts/            # Control scripts
│   ├── start-server.js # Start server and show QR
│   ├── stop-server.js  # Stop server
│   ├── show-qrcode.js  # Display QR code
│   ├── show-status.js  # Show detailed status
│   └── statusline.sh   # Statusline script
├── skills/             # Skill definitions
│   ├── start/          # /remote-bridge:start
│   ├── stop/           # /remote-bridge:stop
│   └── status/         # /remote-bridge:status
├── skill/              # Node.js server
│   ├── server.js       # Main server
│   ├── handlers/       # Request handlers
│   └── utils/          # Utilities (config, logger, state)
├── docs/               # Documentation
└── INSTALL.md          # Installation guide
```

## Documentation

- [Installation Guide](INSTALL.md) - Detailed setup instructions
- [API Documentation](docs/API.md) - Server API reference
- [Privacy Policy](docs/PRIVACY.md) - Data handling practices

## Troubleshooting

### QR Code Not Displaying
1. Make sure qrcode-terminal is installed: `cd skill && npm install`
2. Check if state file exists: `cat ~/.claude/remote-bridge/state.json`
3. Try starting manually: `node scripts/start-server.js`

### Server Won't Start
1. Check if port 3000 is in use: `lsof -i :3000`
2. Verify Node.js version: `node -v` (must be 18+)
3. Check logs: `cat /tmp/claude-bridge.log`

### Connection Issues
1. Verify QR code data contains valid URL and key
2. Check if both devices are on same network (for local connection)
3. Try the public tunnel URL if local IP doesn't work

### Statusline Not Updating
1. Check state file: `cat ~/.claude/remote-bridge/state.json`
2. Verify statusline script is executable: `chmod +x scripts/statusline.sh`

## License

MIT License - see [LICENSE](LICENSE) for details.

## Building Your Own Client

You can integrate with Remote Bridge from any application that supports WebSocket connections. See the [API Documentation](docs/API.md) for complete details.

### Quick Integration Guide

**1. Connect via WebSocket:**
```javascript
const ws = new WebSocket('ws://host:port?key=API_KEY&device=MyClient');
```

**2. Handle connection:**
```javascript
ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle: connected, shell.stdout, shell.completed, etc.
};
```

**3. Execute commands via HTTP:**
```bash
curl -X POST http://host:port/shell/exec \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

**4. Or type directly into terminal:**
```bash
curl -X POST http://host:port/shell/type \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "git status", "submit": true}'
```

For complete API reference including all endpoints, WebSocket protocol, and code examples in Python/JavaScript/cURL, see [docs/API.md](docs/API.md).

## Links

- **Plugin Repository**: [github.com/gabrielvisconti89/remote-bridge-plugin](https://github.com/gabrielvisconti89/remote-bridge-plugin)
- **Issues**: [GitHub Issues](https://github.com/gabrielvisconti89/remote-bridge-plugin/issues)

---

Made with Claude Code
