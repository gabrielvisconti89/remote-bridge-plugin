# Remote Bridge Plugin

Claude Code plugin for remote control from your mobile device.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-blue.svg)]()

## Overview

Remote Bridge is a Claude Code plugin that starts a local server allowing you to control Claude Code from your mobile device. The server starts automatically when you begin a Claude Code session and stops when you end it.

**Requires companion app:** [Remote Bridge Mobile App](https://github.com/gabrielvisconti89/remote-bridge)

## Architecture

```
+-----------------+      HTTP/WS      +-----------------+      Local      +-----------------+
|   Mobile App    | <---------------> |  Plugin Server  | <-------------> |   Claude Code   |
|  (iOS/Android)  |                   |    (Node.js)    |                 |     (CLI)       |
+-----------------+                   +-----------------+                 +-----------------+
```

## Installation

### From Claude Code Marketplace

```bash
claude plugin install remote-bridge
```

### Manual Installation

```bash
git clone https://github.com/gabrielvisconti89/remote-bridge-plugin.git
cd remote-bridge-plugin
./scripts/install.sh
```

## How It Works

1. **SessionStart Hook**: When you start a Claude Code session, the plugin automatically starts a local server
2. **Mobile Connection**: Use the companion app to connect to the server
3. **Remote Control**: Send commands from your phone to Claude Code
4. **SessionEnd Hook**: When you end the session, the server stops automatically

## Features

| Feature | Description |
|---------|-------------|
| **Remote Execution** | Run shell commands from your phone |
| **Typing Mode** | Type commands directly into the terminal |
| **Real-time** | WebSocket connection for instant feedback |
| **Secure** | API key authentication, optional HTTPS |
| **Cross-platform** | Runs on macOS, Linux, Windows |
| **Auto Start/Stop** | Server lifecycle managed by Claude Code hooks |

## Configuration

Environment variables (set in `skill/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILL_PORT` | 3000 | HTTP/WebSocket port |
| `SKILL_HOST` | 0.0.0.0 | Bind address |
| `SKILL_API_KEY` | (auto-generated) | Authentication key |
| `SKILL_LOG_LEVEL` | info | Log verbosity |

## Connection Info

When the server starts, it displays connection information:

```
============================================================
           REMOTE BRIDGE - Connection Info
============================================================
  Public URL:  https://xxxxx.loca.lt
  API Key:     xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  Local:       http://localhost:3000
============================================================
```

Use these values in the mobile app to connect.

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

This plugin requires the Remote Bridge mobile app to function. Get it here:

- **Repository**: [github.com/gabrielvisconti89/remote-bridge](https://github.com/gabrielvisconti89/remote-bridge)
- **iOS**: Available on the App Store (search "Remote Bridge")
- **Android**: Coming soon

## Project Structure

```
remote-bridge-plugin/
├── .claude-plugin/     # Plugin manifest and marketplace info
├── scripts/            # Lifecycle hooks (start/stop server)
├── skill/              # Node.js server
│   ├── server.js       # Main server
│   ├── handlers/       # Request handlers
│   └── utils/          # Utilities
├── docs/               # Documentation
└── INSTALL.md          # Installation guide
```

## Documentation

- [Installation Guide](INSTALL.md) - Detailed setup instructions
- [API Documentation](docs/API.md) - Server API reference
- [Privacy Policy](docs/PRIVACY.md) - Data handling practices

## Troubleshooting

### Server Won't Start
1. Check if port 3000 is in use: `lsof -i :3000`
2. Verify Node.js version: `node -v` (must be 18+)
3. Check logs: `cat /tmp/remote-bridge.log`

### Connection Issues
1. Verify API key is correct
2. Check if both devices are on same network (for local connection)
3. Try the public tunnel URL if local IP doesn't work

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- **Plugin Repository**: [github.com/gabrielvisconti89/remote-bridge-plugin](https://github.com/gabrielvisconti89/remote-bridge-plugin)
- **Mobile App Repository**: [github.com/gabrielvisconti89/remote-bridge](https://github.com/gabrielvisconti89/remote-bridge)
- **Issues**: [GitHub Issues](https://github.com/gabrielvisconti89/remote-bridge-plugin/issues)

---

Made with Claude Code
