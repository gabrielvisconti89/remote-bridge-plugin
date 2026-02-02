# Remote Bridge Hooks

The Remote Bridge plugin uses Claude Code hooks to integrate with the session lifecycle and tool usage events.

## Overview

Hooks are scripts that run automatically when specific events occur in Claude Code. The plugin registers three hooks:

| Hook | Event | Script |
|------|-------|--------|
| SessionStart | New session begins | `scripts/start-server.js` |
| SessionEnd | Session terminates | `scripts/stop-server.js` |
| PostToolUse | Tool execution completes | `scripts/post-tool-hook.js` |

## Hook Configuration

Hooks are defined in `.claude-plugin/plugin.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/start-server.js"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/stop-server.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/post-tool-hook.js"
          }
        ]
      }
    ]
  }
}
```

### Configuration Fields

| Field | Description |
|-------|-------------|
| `matcher` | Regex pattern to filter events (empty = match all) |
| `type` | Hook type: `command`, `prompt`, or `agent` |
| `command` | Script to execute |

### Environment Variables

Claude Code provides these variables to hook scripts:

| Variable | Description |
|----------|-------------|
| `CLAUDE_PLUGIN_ROOT` | Plugin installation directory |
| `CLAUDE_SESSION_ID` | Current session identifier |
| `CLAUDE_PROJECT_DIR` | Current project directory |

## SessionStart Hook

**Script:** `scripts/start-server.js`

This hook runs when a new Claude Code session begins.

### What It Does

1. Receives hook event data via stdin (JSON)
2. Checks if server is already running (via PID file)
3. If not running, spawns server process in background
4. Waits for server to initialize and tunnel to connect
5. Saves connection info to state file

### Input (stdin)

```json
{
  "hook_event_name": "SessionStart",
  "session_id": "abc123",
  "cwd": "/path/to/project"
}
```

### Behavior

```
SessionStart Event
        │
        ▼
┌───────────────────┐
│ Check PID file    │
│ (/tmp/remote-     │
│  bridge.pid)      │
└───────────────────┘
        │
        ├── Exists & Process Alive → Exit (already running)
        │
        ▼
┌───────────────────┐
│ Spawn server.js   │
│ (detached)        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Save PID to file  │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Wait for tunnel   │
│ (up to 10s)       │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Update state.json │
│ with URL/key      │
└───────────────────┘
```

### Files Created

- `/tmp/remote-bridge.pid` - Server process ID
- `/tmp/remote-bridge.log` - Server stdout/stderr
- `~/.claude/remote-bridge/state.json` - Connection state

## SessionEnd Hook

**Script:** `scripts/stop-server.js`

This hook runs when the Claude Code session terminates.

### What It Does

1. Reads PID from `/tmp/remote-bridge.pid`
2. Sends SIGTERM to the server process
3. Cleans up PID and log files
4. Clears state file

### Input (stdin)

```json
{
  "hook_event_name": "SessionEnd",
  "session_id": "abc123"
}
```

### Behavior

```
SessionEnd Event
        │
        ▼
┌───────────────────┐
│ Read PID file     │
└───────────────────┘
        │
        ├── Not Found → Exit (nothing to stop)
        │
        ▼
┌───────────────────┐
│ Send SIGTERM      │
│ to process        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Remove PID file   │
│ Remove log file   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Clear state.json  │
└───────────────────┘
```

### Files Removed

- `/tmp/remote-bridge.pid`
- `/tmp/remote-bridge.log`

## PostToolUse Hook

**Script:** `scripts/post-tool-hook.js`

This hook runs after Claude Code executes any tool (Bash, Edit, Write, Read, etc.).

### What It Does

1. Receives tool usage data via stdin (JSON)
2. Extracts relevant information (tool name, command, result)
3. Sends activity notification to server via HTTP
4. Server broadcasts to connected mobile app

### Input (stdin)

```json
{
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la"
  },
  "tool_result": {
    "output": "total 64\n..."
  }
}
```

### Behavior

```
PostToolUse Event
        │
        ▼
┌───────────────────┐
│ Parse tool data   │
│ from stdin        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Read state.json   │
│ (get server URL)  │
└───────────────────┘
        │
        ├── Server Not Running → Exit
        │
        ▼
┌───────────────────┐
│ POST to           │
│ /claude/activity  │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Server broadcasts │
│ to mobile app     │
└───────────────────┘
```

### Activity Data Sent

```json
{
  "type": "tool_use",
  "tool": "Bash",
  "command": "ls -la",
  "result": "success",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### WebSocket Message (to app)

```json
{
  "type": "claude.activity",
  "tool": "Bash",
  "command": "ls -la",
  "text": "[Bash] ls -la",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

## Matcher Patterns

The `matcher` field allows filtering which events trigger a hook.

### SessionStart Matchers

| Pattern | Description |
|---------|-------------|
| `""` | All session starts |
| `startup` | Initial startup only |
| `resume` | Session resume only |
| `clear` | After `/clear` command |
| `compact` | After context compaction |

### PostToolUse Matchers

| Pattern | Description |
|---------|-------------|
| `""` | All tools |
| `Bash` | Only Bash tool |
| `Edit\|Write` | Edit or Write tools |
| `mcp__.*` | All MCP tools |
| `Read` | Only Read tool |

### Example: Filter to Bash Only

```json
{
  "PostToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/scripts/post-tool-hook.js"
        }
      ]
    }
  ]
}
```

## Debugging Hooks

### View Hook Output

Hook stdout/stderr is captured by Claude Code. To debug:

```bash
# Check server log
tail -f /tmp/remote-bridge.log

# Check if server is running
cat /tmp/remote-bridge.pid

# Check state
cat ~/.claude/remote-bridge/state.json
```

### Manual Hook Execution

Test hooks manually with sample input:

```bash
# Test SessionStart hook
echo '{"hook_event_name":"SessionStart"}' | \
  /path/to/plugin/scripts/start-server.js

# Test PostToolUse hook
echo '{"hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' | \
  /path/to/plugin/scripts/post-tool-hook.js
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Server doesn't start | Missing node_modules | Run `npm install` in `skill/` |
| Hooks don't fire | Wrong schema format | Check plugin.json structure |
| Activity not sent | Server not running | Run `/remote-bridge:start` |
| Permission denied | Script not executable | `chmod +x scripts/*.js` |

## See Also

- [Architecture](ARCHITECTURE.md) - System design overview
- [Skills](SKILLS.md) - Manual server control
- [Debugging](DEBUGGING.md) - Troubleshooting guide
