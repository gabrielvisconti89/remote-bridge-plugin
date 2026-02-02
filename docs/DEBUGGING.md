# Debugging Guide

This guide helps troubleshoot common issues with the Remote Bridge plugin.

## Log File Locations

| Log | Location | Contents |
|-----|----------|----------|
| Server Log | `/tmp/remote-bridge.log` | Server stdout/stderr |
| PID File | `/tmp/remote-bridge.pid` | Server process ID |
| State | `~/.claude/remote-bridge/state.json` | Server state |
| Metrics | `~/.claude/remote-bridge/metrics.json` | Message counters |
| Commands | `~/.claude/remote-bridge/commands.json` | Command queue |
| Output | `~/.claude/remote-bridge/output.log` | Terminal output |

## Quick Diagnostics

### Check Server Status

```bash
# Is server running?
cat /tmp/remote-bridge.pid 2>/dev/null && echo "Server PID: $(cat /tmp/remote-bridge.pid)" || echo "Server not running"

# Check if process is alive
ps -p $(cat /tmp/remote-bridge.pid 2>/dev/null) 2>/dev/null && echo "Process alive" || echo "Process dead"

# Server state
cat ~/.claude/remote-bridge/state.json 2>/dev/null | python3 -m json.tool
```

### Check Server Health

```bash
# Local health check
curl -s http://localhost:3000/health -H "X-API-Key: YOUR_KEY"

# Tunnel health check
curl -s https://xxx.loca.lt/health -H "X-API-Key: YOUR_KEY" -H "bypass-tunnel-reminder: true"
```

### View Server Logs

```bash
# Real-time logs
tail -f /tmp/remote-bridge.log

# Last 50 lines
tail -50 /tmp/remote-bridge.log

# Filter errors
grep -i error /tmp/remote-bridge.log
```

## Common Issues

### Plugin Not Loading

**Symptom:** Plugin shows "failed to load" in `/plugin` command.

**Causes & Solutions:**

1. **Invalid JSON in plugin.json:**
   ```bash
   # Validate JSON
   cat .claude-plugin/plugin.json | python3 -m json.tool
   ```
   Fix any JSON syntax errors.

2. **Skills format wrong:**
   ```json
   // Correct format
   {
     "skills": [
       {
         "name": "start",
         "path": "skills/start/SKILL.md",
         "description": "Start Remote Bridge"
       }
     ]
   }
   ```

3. **Scripts not executable:**
   ```bash
   chmod +x scripts/*.js scripts/*.sh
   ```

4. **Missing node_modules:**
   ```bash
   cd skill && npm install
   ```

### Server Won't Start

**Symptom:** `/remote-bridge:start` fails or server doesn't respond.

**Causes & Solutions:**

1. **Port already in use:**
   ```bash
   # Check what's using port 3000
   lsof -i :3000

   # Kill existing process
   kill $(lsof -t -i :3000)
   ```

2. **Missing dependencies:**
   ```bash
   cd skill && npm install
   ```

3. **Node.js version too old:**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

4. **Previous server not stopped:**
   ```bash
   # Force stop
   kill $(cat /tmp/remote-bridge.pid)
   rm /tmp/remote-bridge.pid
   ```

### Can't Connect from Mobile App

**Symptom:** Mobile app can't reach the server.

**Causes & Solutions:**

1. **Tunnel not established:**
   ```bash
   # Check for tunnel URL in state
   grep url ~/.claude/remote-bridge/state.json
   ```

2. **Localtunnel bypass required:**
   - Open tunnel URL in browser
   - Click "Click to Continue"
   - Retry connection

3. **Wrong API key:**
   ```bash
   # Get correct API key
   grep apiKey ~/.claude/remote-bridge/state.json
   ```

4. **Firewall blocking:**
   ```bash
   # macOS: Check System Preferences > Security > Firewall
   # Linux: Check ufw status
   ```

### WebSocket Disconnects

**Symptom:** App connects but immediately disconnects.

**Causes & Solutions:**

1. **Invalid API key:**
   - Check API key matches server
   - Key is passed as `?key=` query parameter

2. **Heartbeat timeout:**
   - Check network stability
   - Server expects pong within 30s

3. **SSL issues:**
   - Localtunnel uses HTTPS
   - Ensure app accepts the certificate

### No Output in Mobile App

**Symptom:** Commands execute but no output appears.

**Causes & Solutions:**

1. **Output watcher not running:**
   ```bash
   # Check if output.log exists
   ls -la ~/.claude/remote-bridge/output.log

   # Check watcher is logging
   grep "OutputWatcher" /tmp/remote-bridge.log
   ```

2. **Output file not being written:**
   - Output capture depends on terminal configuration
   - Check if output.log has content

3. **WebSocket not connected:**
   - Check connection state in app
   - Review server logs for disconnection

### Commands Not Executing

**Symptom:** Commands sent from app but nothing happens.

**Causes & Solutions:**

1. **Commands in queue (expected):**
   ```bash
   # Check command queue
   cat ~/.claude/remote-bridge/commands.json
   ```
   Use `/remote-bridge:inbox` to review and execute.

2. **Server not receiving:**
   ```bash
   # Check metrics
   cat ~/.claude/remote-bridge/metrics.json
   ```
   If `received` is 0, connection issue.

3. **API error:**
   Check server logs for POST errors.

### Mode Toggle Not Working

**Symptom:** Toggle in app but mode doesn't change.

**Causes & Solutions:**

1. **Terminal not focused:**
   - Keystroke sent to wrong window
   - Focus Claude Code terminal first

2. **Platform not supported:**
   - Windows mode toggle not implemented
   - Only macOS and Linux supported

3. **xdotool missing (Linux):**
   ```bash
   which xdotool || sudo apt install xdotool
   ```

### Statusline Not Showing

**Symptom:** No statusline in Claude Code.

**Causes & Solutions:**

1. **Server not running:**
   - Start server with `/remote-bridge:start`

2. **State file missing:**
   ```bash
   ls -la ~/.claude/remote-bridge/state.json
   ```

3. **Script error:**
   ```bash
   # Test statusline script
   ./scripts/statusline.sh
   ```

## Advanced Debugging

### Enable Debug Logging

```bash
# Set log level
export SKILL_LOG_LEVEL=debug

# Restart server
/path/to/scripts/stop-server.js
/path/to/scripts/start-server.js
```

### Network Debugging

```bash
# Test local connection
curl -v http://localhost:3000/health -H "X-API-Key: KEY"

# Test tunnel connection
curl -v https://xxx.loca.lt/health -H "X-API-Key: KEY" -H "bypass-tunnel-reminder: true"

# WebSocket test
websocat "ws://localhost:3000?key=YOUR_KEY"
```

### Process Debugging

```bash
# Attach to running server
node --inspect skill/server.js

# View open files
lsof -p $(cat /tmp/remote-bridge.pid)

# View memory usage
ps -o pid,rss,vsz,command -p $(cat /tmp/remote-bridge.pid)
```

### Hook Debugging

```bash
# Test hook manually
echo '{"hook_event_name":"SessionStart"}' | ./scripts/start-server.js

# Check hook is registered
cat .claude-plugin/plugin.json | grep -A5 hooks
```

## Error Messages

### "EADDRINUSE"

Port 3000 already in use. Kill existing process or use different port:

```bash
PORT=3001 node skill/server.js
```

### "Unauthorized"

API key mismatch. Check:
- Header: `X-API-Key`
- Query: `?key=`
- State file for correct key

### "ECONNREFUSED"

Server not running or wrong address. Check:
- Server is running
- Using correct host/port
- Tunnel is established

### "Tunnel closed"

Localtunnel disconnected. Usually reconnects automatically. If persistent:
- Check internet connection
- Restart server

## Reset Everything

If all else fails, reset to clean state:

```bash
# Stop server
./scripts/stop-server.js

# Clear all state
rm -rf ~/.claude/remote-bridge/*
rm -f /tmp/remote-bridge.pid
rm -f /tmp/remote-bridge.log

# Reinstall dependencies
cd skill && rm -rf node_modules && npm install

# Start fresh
/remote-bridge:start
```

## Getting Help

1. Check this guide first
2. Review server logs: `/tmp/remote-bridge.log`
3. Check state files in `~/.claude/remote-bridge/`
4. Open issue on GitHub with logs and state

## See Also

- [Architecture](ARCHITECTURE.md) - System design
- [Hooks](HOOKS.md) - Hook troubleshooting
- [Tunneling](TUNNELING.md) - Network issues
