# Statusline

Remote Bridge provides a statusline that displays connection status in Claude Code.

## Overview

The statusline appears at the bottom of the Claude Code interface, showing real-time information about the Remote Bridge connection.

## Configuration

The statusline is configured in `.claude-plugin/plugin.json`:

```json
{
  "statusline": {
    "command": "${CLAUDE_PLUGIN_ROOT}/scripts/statusline.sh",
    "refresh": 5
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | Script to generate statusline text |
| `refresh` | number | Refresh interval in seconds |

## Display States

### Server Not Running

When the server is not running, the statusline is hidden (script exits with empty output).

### Waiting for Connection

When server is running but no app is connected:

```
🌐 Remote Bridge: 🟡 Aguardando conexão...
```

### Connected

When app is connected:

```
🌐 Remote Bridge: 🟢 Conectado | ↑ 150 ↓ 75 | 📱 iPhone 15
```

| Element | Description |
|---------|-------------|
| 🌐 | Remote Bridge indicator |
| 🟢/🟡 | Connection status (green/yellow) |
| ↑ 150 | Messages sent to app |
| ↓ 75 | Messages received from app |
| 📱 iPhone 15 | Connected device name |

## How It Works

### State Files

The script reads from:

- `~/.claude/remote-bridge/state.json` - Server and connection state
- `~/.claude/remote-bridge/metrics.json` - Message counters

### Script Logic

```bash
#!/bin/bash

STATE_FILE="$HOME/.claude/remote-bridge/state.json"
METRICS_FILE="$HOME/.claude/remote-bridge/metrics.json"

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
  exit 0  # No output = statusline hidden
fi

# Read state values
ENABLED=$(grep -o '"enabled"[[:space:]]*:[[:space:]]*\(true\|false\)' "$STATE_FILE" | ...)
CONNECTED=$(grep -o '"connected"[[:space:]]*:[[:space:]]*\(true\|false\)' "$STATE_FILE" | ...)
DEVICE=$(grep -o '"connectedDevice"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE_FILE" | ...)

# If not enabled, no output
if [ "$ENABLED" != "true" ]; then
  exit 0
fi

# Read metrics
SENT=$(grep -o '"sent"[[:space:]]*:[[:space:]]*[0-9]*' "$METRICS_FILE" | ...)
RECEIVED=$(grep -o '"received"[[:space:]]*:[[:space:]]*[0-9]*' "$METRICS_FILE" | ...)

# Output based on state
if [ "$CONNECTED" = "true" ] && [ -n "$DEVICE" ]; then
  echo "🌐 Remote Bridge: 🟢 Conectado | ↑ $SENT ↓ $RECEIVED | 📱 $DEVICE"
else
  echo "🌐 Remote Bridge: 🟡 Aguardando conexão..."
fi
```

## Customization

### Change Refresh Interval

Edit `plugin.json` to change how often the statusline updates:

```json
{
  "statusline": {
    "refresh": 10  // Update every 10 seconds
  }
}
```

### Customize Display Format

Edit `scripts/statusline.sh` to change the display format:

```bash
# Example: Show only connection status
if [ "$CONNECTED" = "true" ]; then
  echo "📱 Connected to $DEVICE"
else
  echo "📱 Waiting..."
fi
```

### Add Mode Indicators

Show current mode state in statusline:

```bash
# Read modes from state
PLAN=$(grep -o '"plan"[[:space:]]*:[[:space:]]*\(true\|false\)' "$STATE_FILE" | ...)

# Include in output
if [ "$PLAN" = "true" ]; then
  MODES="[Plan]"
else
  MODES=""
fi

echo "🌐 Remote Bridge: 🟢 $DEVICE $MODES"
```

## Troubleshooting

### Statusline Not Showing

1. **Server not running:** Start with `/remote-bridge:start`
2. **State file missing:** Check `~/.claude/remote-bridge/state.json` exists
3. **Script error:** Run script manually to check for errors:
   ```bash
   /path/to/plugin/scripts/statusline.sh
   ```

### Statusline Not Updating

1. **Refresh interval:** Default is 5 seconds, wait for update
2. **State file stale:** Check if server is updating state
3. **Plugin not loaded:** Verify plugin is enabled

### Wrong Information

1. **Metrics reset:** Counters reset on server restart
2. **Device name null:** App didn't send device name
3. **Connection state:** State may be stale if app disconnected unexpectedly

## State File Format

### state.json

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

### metrics.json

```json
{
  "sent": 150,
  "received": 75,
  "lastActivity": "2026-02-02T12:30:00.000Z"
}
```

## Implementation Details

### File Location

`scripts/statusline.sh` - Bash script that reads state and outputs text.

### Dependencies

- Bash (standard shell)
- grep (for JSON parsing)
- sed (for string extraction)

### Error Handling

- Missing files: Script exits with no output (statusline hidden)
- Invalid JSON: Fallback to default values
- Missing fields: Use empty strings or zeros

## Emoji Support

The statusline uses emojis for visual indicators. If your terminal doesn't support emojis, you can use text alternatives:

```bash
# ASCII alternatives
# Instead of: 🌐 Remote Bridge: 🟢 Conectado
# Use:        [Remote Bridge] CONNECTED
```

## See Also

- [Architecture](ARCHITECTURE.md) - State file details
- [Skills](SKILLS.md) - Server control commands
- [Debugging](DEBUGGING.md) - Troubleshooting tips
