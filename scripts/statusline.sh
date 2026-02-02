#!/bin/bash

# Remote Bridge Statusline Script
# Reads state from ~/.claude/remote-bridge/ and outputs statusline text

STATE_FILE="$HOME/.claude/remote-bridge/state.json"
METRICS_FILE="$HOME/.claude/remote-bridge/metrics.json"

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Read state using node (more reliable JSON parsing)
STATE=$(cat "$STATE_FILE" 2>/dev/null)
if [ -z "$STATE" ]; then
  exit 0
fi

# Parse state values
ENABLED=$(echo "$STATE" | grep -o '"enabled"[[:space:]]*:[[:space:]]*\(true\|false\)' | grep -o '\(true\|false\)' | head -1)
CONNECTED=$(echo "$STATE" | grep -o '"connected"[[:space:]]*:[[:space:]]*\(true\|false\)' | grep -o '\(true\|false\)' | head -1)
DEVICE=$(echo "$STATE" | grep -o '"connectedDevice"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//' | sed 's/"$//' | head -1)

# If not enabled, no output
if [ "$ENABLED" != "true" ]; then
  exit 0
fi

# Read metrics if available
SENT=0
RECEIVED=0
if [ -f "$METRICS_FILE" ]; then
  METRICS=$(cat "$METRICS_FILE" 2>/dev/null)
  if [ -n "$METRICS" ]; then
    SENT=$(echo "$METRICS" | grep -o '"sent"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*' | head -1)
    RECEIVED=$(echo "$METRICS" | grep -o '"received"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*' | head -1)
    SENT=${SENT:-0}
    RECEIVED=${RECEIVED:-0}
  fi
fi

# Output statusline based on connection state
if [ "$CONNECTED" = "true" ] && [ -n "$DEVICE" ] && [ "$DEVICE" != "null" ]; then
  # Connected mode: show device and counters
  echo "🌐 Remote Bridge: 🟢 Conectado | ↑ $SENT ↓ $RECEIVED | 📱 $DEVICE"
else
  # Waiting mode: show waiting message
  echo "🌐 Remote Bridge: 🟡 Aguardando conexão..."
fi
