#!/bin/bash
#
# Start Claude Code with terminal output capture for Remote Bridge
#
# This script launches Claude Code wrapped with 'script' command to capture
# all terminal output to a log file that the Remote Bridge plugin monitors.
#

# Configuration
LOG_DIR="$HOME/.claude/remote-bridge"
LOG_FILE="$LOG_DIR/output.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Clear the log file on startup
> "$LOG_FILE"

echo "Starting Claude Code with Remote Bridge output capture..."
echo "Output will be logged to: $LOG_FILE"
echo ""

# Detect OS and use appropriate script command
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    exec script -q "$LOG_FILE" claude "$@"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    exec script -q -c "claude $*" "$LOG_FILE"
else
    # Fallback - try macOS style first
    exec script -q "$LOG_FILE" claude "$@" 2>/dev/null || exec script -q -c "claude $*" "$LOG_FILE"
fi
