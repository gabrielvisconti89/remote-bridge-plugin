---
name: inbox
description: View and execute pending commands sent from the Remote Bridge mobile app
---

# Remote Bridge Inbox

This skill shows pending commands sent from the Remote Bridge mobile app and allows you to execute or dismiss them.

## What It Does

1. Reads the command queue from `~/.claude/remote-bridge/commands.json`
2. Displays pending commands with details (command, sender, time)
3. Lets you execute or dismiss commands

## Instructions

Execute the following steps:

### Step 1: Display Pending Commands

Run the show-inbox script to display pending commands:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/show-inbox.js"
```

### Step 2: Process Commands

If there are pending commands, they will be displayed with their IDs.

For each command, decide whether to:

**Execute a command:**
```bash
curl -s -X POST "http://localhost:3847/shell/queue/{COMMAND_ID}/execute" \
  -H "X-API-Key: $(cat ~/.claude/remote-bridge/state.json | grep -o '"apiKey": "[^"]*"' | cut -d'"' -f4)" \
  -H "Content-Type: application/json"
```

**Dismiss a command (skip without executing):**
```bash
curl -s -X POST "http://localhost:3847/shell/queue/{COMMAND_ID}/dismiss" \
  -H "X-API-Key: $(cat ~/.claude/remote-bridge/state.json | grep -o '"apiKey": "[^"]*"' | cut -d'"' -f4)" \
  -H "Content-Type: application/json"
```

### Alternative: Direct Execution

You can also execute the commands directly using the Bash tool after showing them to the user and getting confirmation.

## User Interaction

When showing commands to the user:

1. Display each pending command clearly
2. Ask the user which commands they want to execute
3. Execute or dismiss based on user's choice

## Commands with Image Attachments

When a command has an image attached:

1. The inbox shows the image path next to the command
2. **IMPORTANT:** Use the Read tool to view the image: `Read /path/to/image.jpg`
3. Analyze the image together with the command text
4. Execute the task considering both the text instruction and the visual context

Example workflow:
```
Command: "Fix the bug shown in this screenshot"
Image:   📎 screenshot.jpg (245 KB)
Path:    ~/.claude/remote-bridge/uploads/img_abc123.jpg

Steps:
1. First, read the attached image to understand the bug
2. [Use Read tool on the image path]
3. Analyze what the image shows
4. Proceed to fix the issue based on visual + text context
```

## User Feedback

If there are pending commands:
> You have {N} pending command(s) from your mobile device:
>
> 1. `{command}` - from {device} at {time}
>    - 📎 Image attached: {filename}
>
> Would you like me to execute any of these commands?

If there are no pending commands:
> Your Remote Bridge inbox is empty. No pending commands from mobile.
