#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/../skill"

echo "================================"
echo "  Installing Claude Bridge"
echo "================================"
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "Error: Node.js not found"
    echo "Please install Node.js 18 or later: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ required (found v$NODE_VERSION)"
    echo "Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi

echo "Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "Installing dependencies..."
cd "$SKILL_DIR"
npm install --production

echo ""
echo "================================"
echo "  Claude Bridge Installed!"
echo "================================"
echo ""
echo "The server will start automatically when you begin a Claude Code session."
echo ""
echo "Manual commands:"
echo "  Start: node scripts/start-server.js"
echo "  Stop:  node scripts/stop-server.js"
echo ""
