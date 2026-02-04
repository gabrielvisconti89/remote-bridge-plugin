# Remote Bridge Plugin

Claude Code plugin for remote control from mobile devices.

> **IMPORTANT:** Before debugging any bug or planning fixes, ALWAYS search the official documentation using Context7 MCP (`resolve-library-id` + `query-docs`). Many issues are caused by incorrect API usage or outdated patterns. Check docs first, then plan and execute.

## Quick Start

```bash
# Install dependencies
cd skill && npm install

# In Claude Code, start the server
/remote-bridge:start

# Scan QR code with mobile app
```

## Project Structure

```
remote-bridge-plugin/
├── .claude-plugin/        # Plugin configuration
│   ├── plugin.json        # Main plugin manifest (hooks, skills, statusline)
│   └── marketplace.json   # Marketplace metadata
├── skill/                 # Node.js server
│   ├── server.js          # Main entry point (Express + WebSocket)
│   ├── handlers/          # HTTP route handlers
│   │   ├── shell.js       # Command execution
│   │   ├── file.js        # File operations
│   │   ├── system.js      # System info
│   │   ├── modes.js       # Mode toggle
│   │   └── commands.js    # Command queue
│   └── utils/             # Utilities
│       ├── state.js       # State file management
│       ├── commandQueue.js # Command queue management
│       ├── outputWatcher.js # Terminal output capture
│       ├── config.js      # Configuration
│       └── logger.js      # Winston logger
├── scripts/               # Hook scripts
│   ├── start-server.js    # SessionStart hook
│   ├── stop-server.js     # SessionEnd hook
│   ├── post-tool-hook.js  # PostToolUse hook
│   ├── statusline.sh      # Statusline display
│   ├── show-qrcode.js     # QR code display
│   └── show-status.js     # Status display
├── skills/                # Skill definitions
│   ├── start/SKILL.md     # /remote-bridge:start
│   ├── stop/SKILL.md      # /remote-bridge:stop
│   ├── status/SKILL.md    # /remote-bridge:status
│   └── inbox/SKILL.md     # /remote-bridge:inbox
└── docs/                  # Documentation
    ├── INDEX.md           # Documentation index
    ├── CLAUDE.md          # Technical overview
    ├── API.md             # API reference
    └── ...                # Feature docs
```

## Key Files

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin hooks, skills, statusline config |
| `skill/server.js` | Express + WebSocket server setup |
| `skill/handlers/shell.js` | Command execution logic |
| `skill/utils/state.js` | State file read/write |
| `skill/utils/outputWatcher.js` | Terminal output monitoring |
| `scripts/start-server.js` | Server startup (SessionStart hook) |
| `scripts/statusline.sh` | Statusline text generation |

## Common Tasks

### Modify API Endpoints

Edit handlers in `skill/handlers/`:
- `shell.js` - Command execution
- `file.js` - File operations
- `modes.js` - Mode toggle
- `commands.js` - Command queue

### Add New Skill

1. Create `skills/{name}/SKILL.md`
2. Add to `plugin.json` skills array
3. Follow existing skill format

### Modify Statusline

Edit `scripts/statusline.sh` to change display format.

### Change Hook Behavior

Edit scripts in `scripts/`:
- `start-server.js` - Server startup
- `stop-server.js` - Server shutdown
- `post-tool-hook.js` - Tool activity notifications

## State Files

All state in `~/.claude/remote-bridge/`:

| File | Contents |
|------|----------|
| `state.json` | Server state (URL, API key, connection) |
| `metrics.json` | Message counters |
| `commands.json` | Command queue |
| `output.log` | Captured terminal output |

## Testing

```bash
# Test server directly
cd skill && node server.js

# Test hook scripts
echo '{"hook_event_name":"SessionStart"}' | ./scripts/start-server.js

# Test statusline
./scripts/statusline.sh
```

## Documentation

See `docs/INDEX.md` for complete documentation including:
- [Architecture](docs/ARCHITECTURE.md) - System design
- [API Reference](docs/API.md) - HTTP & WebSocket API
- [Hooks](docs/HOOKS.md) - Hook documentation
- [Skills](docs/SKILLS.md) - Skill reference
- [Debugging](docs/DEBUGGING.md) - Troubleshooting
