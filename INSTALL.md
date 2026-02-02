# Remote Bridge Plugin Installation Guide

## Overview

Remote Bridge consists of two components:
1. **Plugin** (this repository) - Runs on your computer alongside Claude Code
2. **Mobile App** - iOS/Android app for remote control ([separate repository](https://github.com/gabrielvisconti89/remote-bridge))

## Quick Install (From Marketplace)

**Step 1: Add the marketplace (one-time)**
```bash
claude plugin marketplace add gabrielvisconti89/remote-bridge-plugin
```

**Step 2: Install the plugin**
```bash
claude plugin install remote-bridge@remote-bridge-plugin
```

## Manual Installation

### Requirements

- Node.js 18 or later
- npm 9 or later

### Step 1: Clone Repository

```bash
git clone https://github.com/gabrielvisconti89/remote-bridge-plugin.git
cd remote-bridge-plugin
```

### Step 2: Run Install Script

```bash
./scripts/install.sh
```

This will:
- Install Node.js dependencies
- Configure the plugin for Claude Code

The server will start automatically when you begin a Claude Code session.

### Step 3: Configure (Optional)

```bash
cd skill
cp .env.example .env
# Edit .env to customize settings
```

Available environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILL_PORT` | 3000 | HTTP/WebSocket port |
| `SKILL_HOST` | 0.0.0.0 | Bind address |
| `SKILL_API_KEY` | (auto-generated) | Authentication key |
| `SKILL_LOG_LEVEL` | info | Log verbosity (debug, info, warn, error) |

## Using the Plugin

### Start the Server

Run this command in Claude Code:
```
/remote-bridge:start
```

This displays a QR code:

```
╭─────────────────────────────────────────────────────────────╮
│          🌐 Remote Bridge - Aguardando Conexão...           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│               [QR CODE HERE]                                │
│                                                             │
│  Escaneie com o app Remote Bridge para conectar             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  URL: https://xxxxx.loca.lt                                 │
│  Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx                      │
╰─────────────────────────────────────────────────────────────╯
```

### Connect with Mobile App

1. Open the Remote Bridge app on your phone
2. Tap "Scan QR Code"
3. Point at the QR code in your terminal
4. The app connects automatically!

### Connection Status

Once connected, you'll see a statusline:
```
🌐 Remote Bridge: 🟢 Conectado | ↑ 5 ↓ 12 | 📱 iPhone de Gabriel
```

This shows:
- Connection status (🟢 Connected / 🟡 Waiting)
- Message counters (↑ sent / ↓ received)
- Connected device name

### Check Status

For detailed status information:
```
/remote-bridge:status
```

### Stop the Server

When you're done:
```
/remote-bridge:stop
```

## Mobile App Setup

Get the companion mobile app from: [github.com/gabrielvisconti89/remote-bridge](https://github.com/gabrielvisconti89/remote-bridge)

### iOS

1. Download "Remote Bridge" from the App Store
2. Open the app
3. Tap "Scan QR Code" to scan the terminal QR code
4. Or tap "Add Connection" to enter URL and API Key manually

### Manual Connection

If QR scanning doesn't work:

1. Note the URL and API Key from the terminal
2. In the app, tap "Add Connection"
3. Enter the URL and API Key
4. Tap "Save" and connect

### Local Network

For local network access (faster, no internet required):

1. Use `http://YOUR_COMPUTER_IP:3000` as the host
2. Make sure both devices are on the same network
3. Disable "Use HTTPS/WSS" in connection settings

## Platform-Specific Notes

### macOS

The "Typing Mode" feature uses AppleScript to type commands into Terminal or iTerm2. No additional setup required.

### Linux

For "Typing Mode", install xdotool:

```bash
# Debian/Ubuntu
sudo apt-get install xdotool

# Fedora
sudo dnf install xdotool

# Arch
sudo pacman -S xdotool
```

### Windows

"Typing Mode" uses PowerShell SendKeys. No additional setup required, but the terminal window must be focused.

## Troubleshooting

### Connection Issues

1. **"Invalid API key"**: Make sure you're using the correct API key from the server output
2. **"Connection refused"**: Verify the server is running and the port is accessible
3. **"Tunnel error"**: The public tunnel may have failed; try using local network instead

### Typing Mode Not Working

- **macOS**: Grant Terminal/iTerm2 accessibility permissions in System Preferences
- **Linux**: Ensure xdotool is installed and X11 is running
- **Windows**: The target window must be focused

### Server Won't Start

1. Check if port 3000 is already in use: `lsof -i :3000`
2. Verify Node.js version: `node -v` (must be 18+)
3. Check logs for errors: `cat /tmp/remote-bridge.log`

## Uninstall

```bash
# From marketplace installation
claude plugin uninstall remote-bridge@remote-bridge-plugin

# Manual uninstall
rm -rf remote-bridge-plugin
```

## Support

- Plugin Issues: https://github.com/gabrielvisconti89/remote-bridge-plugin/issues
- Mobile App Issues: https://github.com/gabrielvisconti89/remote-bridge/issues
