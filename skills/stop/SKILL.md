---
name: stop
description: Stop the Remote Bridge server and clear statusline
---

# Remote Bridge Stop

This skill stops the Remote Bridge server and clears the statusline.

## What It Does

1. Stops the running server process
2. Clears the state file
3. Removes statusline configuration

## Instructions

Execute the following:

### Step 1: Stop the Server

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/stop-server.js"
```

### Step 2: Confirm to User

Tell the user:

> Remote Bridge server stopped.
>
> To start again, use `/remote-bridge:start`
