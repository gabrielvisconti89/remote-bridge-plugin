# Command Queue (Inbox)

The command queue provides a safe way to send commands from the mobile app to Claude Code for review and execution.

## Overview

Instead of executing commands directly (which could be dangerous), commands from the mobile app are queued and require explicit review by the user before execution.

## Why a Queue?

### Security

Direct command execution from a mobile device poses risks:

- Network latency could cause unexpected behavior
- Accidental taps could execute destructive commands
- Remote access could be compromised

### User Control

The queue ensures:

- User sees every command before execution
- Commands can be dismissed if unwanted
- Execution timing is controlled by user

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Mobile  │────▶│  Server  │────▶│ commands │────▶│  Claude  │
│   App    │ POST│   API    │write│  .json   │read │   Code   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                       │
                                       │ /inbox skill
                                       ▼
                                 ┌──────────┐
                                 │  User    │
                                 │ Reviews  │
                                 └──────────┘
```

## Queue File

Commands are stored in `~/.claude/remote-bridge/commands.json`:

```json
{
  "queue": [
    {
      "id": "cmd_abc123def456",
      "command": "git status",
      "receivedAt": "2026-02-02T12:00:00.000Z",
      "from": "iPhone 15",
      "status": "pending"
    },
    {
      "id": "cmd_789ghi012jkl",
      "command": "npm test",
      "receivedAt": "2026-02-02T12:01:00.000Z",
      "from": "iPhone 15",
      "status": "executed",
      "updatedAt": "2026-02-02T12:05:00.000Z"
    }
  ]
}
```

### Command Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique command ID (`cmd_` + random hex) |
| `command` | string | Command text to execute |
| `receivedAt` | string | ISO timestamp when received |
| `from` | string | Source device name |
| `status` | string | `pending`, `executed`, or `dismissed` |
| `updatedAt` | string | ISO timestamp of last status change |

## API Reference

### POST /commands

Add a command to the queue.

**Request:**
```bash
curl -X POST http://localhost:3000/commands \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "git status",
    "device": "iPhone 15"
  }'
```

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | Command to queue |
| `device` | string | No | Source device name |

**Response:**
```json
{
  "success": true,
  "entry": {
    "id": "cmd_abc123def456",
    "command": "git status",
    "receivedAt": "2026-02-02T12:00:00.000Z",
    "from": "iPhone 15",
    "status": "pending"
  }
}
```

### GET /commands

Get all commands in the queue.

**Request:**
```bash
curl http://localhost:3000/commands \
  -H "X-API-Key: {api-key}"
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status (`pending`, `executed`, `dismissed`) |

**Response:**
```json
{
  "success": true,
  "count": 3,
  "commands": [
    {
      "id": "cmd_abc123def456",
      "command": "git status",
      "receivedAt": "2026-02-02T12:00:00.000Z",
      "from": "iPhone 15",
      "status": "pending"
    }
  ]
}
```

### GET /commands/:id

Get a specific command.

**Request:**
```bash
curl http://localhost:3000/commands/cmd_abc123def456 \
  -H "X-API-Key: {api-key}"
```

**Response:**
```json
{
  "success": true,
  "command": {
    "id": "cmd_abc123def456",
    "command": "git status",
    "receivedAt": "2026-02-02T12:00:00.000Z",
    "from": "iPhone 15",
    "status": "pending"
  }
}
```

### PATCH /commands/:id

Update command status.

**Request:**
```bash
curl -X PATCH http://localhost:3000/commands/cmd_abc123def456 \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{"status": "executed"}'
```

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | New status: `executed` or `dismissed` |

**Response:**
```json
{
  "success": true,
  "command": {
    "id": "cmd_abc123def456",
    "status": "executed",
    "updatedAt": "2026-02-02T12:05:00.000Z"
  }
}
```

### DELETE /commands/:id

Remove a command from the queue.

**Request:**
```bash
curl -X DELETE http://localhost:3000/commands/cmd_abc123def456 \
  -H "X-API-Key: {api-key}"
```

**Response:**
```json
{
  "success": true,
  "message": "Command removed"
}
```

### DELETE /commands

Clear all commands or completed commands.

**Request (clear all):**
```bash
curl -X DELETE http://localhost:3000/commands \
  -H "X-API-Key: {api-key}"
```

**Request (clear completed only):**
```bash
curl -X DELETE "http://localhost:3000/commands?completed=true" \
  -H "X-API-Key: {api-key}"
```

**Response:**
```json
{
  "success": true,
  "message": "Commands cleared"
}
```

## Inbox Skill

The `/remote-bridge:inbox` skill provides the interface for reviewing queued commands.

### Usage

```
/remote-bridge:inbox
```

### Workflow

1. User invokes `/remote-bridge:inbox`
2. Skill reads pending commands from queue
3. Commands displayed with details
4. For each command:
   - Claude shows the command
   - User approves or dismisses
   - If approved, Claude executes
   - Status updated in queue

### Example Session

```
Claude: Checking command inbox...

============================================================
                  COMMAND INBOX
============================================================
  3 pending commands:

  [1] cmd_abc123 (iPhone 15, 12:00)
      Command: git status

  [2] cmd_def456 (iPhone 15, 12:01)
      Command: npm test

  [3] cmd_ghi789 (iPhone 15, 12:02)
      Command: rm -rf node_modules
============================================================

Claude: Let me process these commands one by one.

For command #1 (git status): This is a safe read-only command.
*Executes: git status*

For command #2 (npm test): This runs the test suite.
*Executes: npm test*

For command #3 (rm -rf node_modules): This will delete the
node_modules directory. Do you want me to proceed?

User: No, dismiss it.

Claude: Command #3 dismissed.
```

## WebSocket Notifications

When commands are added, the server broadcasts to connected clients:

```json
{
  "type": "command.added",
  "command": {
    "id": "cmd_abc123def456",
    "command": "git status",
    "receivedAt": "2026-02-02T12:00:00.000Z",
    "from": "iPhone 15",
    "status": "pending"
  },
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

## Command Queue Utility

The queue is managed by `skill/utils/commandQueue.js`:

```javascript
// Add command
const entry = commandQueue.addCommand("git status", "iPhone 15");

// Get pending commands
const pending = commandQueue.getCommands();

// Update status
commandQueue.updateCommandStatus("cmd_abc123", "executed");

// Remove command
commandQueue.clearCommand("cmd_abc123");

// Clear all
commandQueue.clearAll();

// Clear completed only
commandQueue.clearCompleted();
```

## Best Practices

### For Mobile App Users

1. **Be Specific** - Write complete commands
2. **Review History** - Check executed commands for results
3. **Avoid Destructive** - Think before sending rm -rf

### For Claude Code Users

1. **Check Regularly** - Use `/inbox` to check for commands
2. **Review Carefully** - Understand each command before executing
3. **Dismiss Unsafe** - Don't execute commands you're unsure about

### For Developers

1. **Validate Input** - Check command format before queuing
2. **Rate Limit** - Consider limiting commands per minute
3. **Log Activity** - Track command execution for debugging

## Security Considerations

### Command Validation

Consider validating commands before queueing:

- Block known dangerous patterns
- Limit command length
- Require confirmation for sensitive operations

### Audit Trail

All commands are logged with:
- Timestamp
- Source device
- Status changes

### Access Control

- API key required for all endpoints
- Consider additional authentication for destructive operations

## See Also

- [Skills](SKILLS.md) - Inbox skill documentation
- [Security](SECURITY.md) - Security best practices
- [API Reference](API.md) - Full API documentation
