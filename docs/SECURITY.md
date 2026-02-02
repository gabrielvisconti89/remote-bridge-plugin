# Security

This document covers security considerations and best practices for the Remote Bridge plugin.

## Authentication

### API Key

Remote Bridge uses API key authentication for all requests.

**Key Generation:**
- Automatically generated on server start
- 32 characters, cryptographically random hex
- Stored in `~/.claude/remote-bridge/state.json`

**Key Transmission:**
- HTTP: `X-API-Key` header
- WebSocket: `?key=` query parameter

**Example:**
```bash
# HTTP request
curl http://localhost:3000/health -H "X-API-Key: a1b2c3d4..."

# WebSocket connection
ws://localhost:3000?key=a1b2c3d4...
```

### Key Rotation

The API key changes on each server restart. This provides:
- Natural key rotation
- Previous sessions invalidated
- No persistent credentials

For persistent keys, set `SKILL_API_KEY` environment variable.

## Command Safety

### Command Queue

Commands from mobile are **never executed directly**. They go through a queue:

```
Mobile App → Queue → User Review → Execution
```

This prevents:
- Accidental command execution
- Remote code execution attacks
- Unintended destructive operations

### Command Review

Users must explicitly review commands via `/remote-bridge:inbox`:

1. See full command text
2. Approve or dismiss
3. Claude explains potential impact

### Dangerous Commands

Consider implementing additional checks for:

- `rm -rf` commands
- `sudo` operations
- File deletions
- System modifications

## Network Security

### Localtunnel (Default)

**Pros:**
- HTTPS encryption
- No port forwarding needed
- Works behind NAT/firewall

**Cons:**
- Third-party service dependency
- URL is predictable pattern
- Rate limiting may affect availability

**Recommendations:**
- Use only for development/testing
- Don't share tunnel URL publicly
- Regenerate URL for sensitive sessions

### SSH Tunnel (Recommended for Production)

**Pros:**
- End-to-end encryption
- No third-party dependency
- Controlled access

**Setup:**
```bash
ssh -R 443:localhost:3000 user@your-server.com
```

See [Tunneling](TUNNELING.md) for details.

### Local Network

**Pros:**
- Direct connection
- No external exposure
- Fastest performance

**Cons:**
- Traffic not encrypted
- Limited to same network

**Recommendations:**
- Use only on trusted networks
- Enable firewall rules
- Consider VPN for remote access

## Data Privacy

### What's Transmitted

| Data | Direction | Purpose |
|------|-----------|---------|
| Commands | App → Server | User input for Claude |
| Output | Server → App | Terminal output |
| Activity | Server → App | Tool usage notifications |
| State | Server → App | Connection status |

### What's Stored

| Data | Location | Purpose |
|------|----------|---------|
| API Key | state.json | Authentication |
| Commands | commands.json | Command queue |
| Metrics | metrics.json | Usage statistics |
| Output | output.log | Terminal capture |

### Data Retention

- State files persist until server restart
- Command queue can be manually cleared
- Output log grows until cleared
- No data sent to external services

## Access Control

### File Permissions

Recommended permissions:

```bash
# State directory
chmod 700 ~/.claude/remote-bridge/

# State files
chmod 600 ~/.claude/remote-bridge/*.json

# Server logs
chmod 600 /tmp/remote-bridge.log
```

### Process Isolation

Server runs with user permissions:
- Can only access user-owned files
- Cannot escalate privileges
- Inherits shell environment

## Threat Model

### In-Scope Threats

| Threat | Mitigation |
|--------|------------|
| Unauthorized access | API key authentication |
| Command injection | Command queue + review |
| Network eavesdropping | HTTPS via tunnel |
| Session hijacking | Key regeneration on restart |

### Out-of-Scope Threats

| Threat | Reasoning |
|--------|-----------|
| Physical device access | User's responsibility |
| Malicious plugins | Claude Code's responsibility |
| Server compromise | Beyond plugin scope |
| Mobile app compromise | App's responsibility |

## Best Practices

### For Users

1. **Protect API Key:**
   - Don't share QR code publicly
   - Close session when done
   - Use `/remote-bridge:stop` when not needed

2. **Review Commands:**
   - Always use `/inbox` to review
   - Don't auto-approve commands
   - Understand before executing

3. **Network Security:**
   - Use trusted networks
   - Prefer SSH tunnel for remote
   - Don't expose locally without tunnel

### For Developers

1. **Input Validation:**
   ```javascript
   // Validate command input
   function validateCommand(cmd) {
     if (typeof cmd !== 'string') return false;
     if (cmd.length > 10000) return false;
     if (cmd.includes('\x00')) return false;
     return true;
   }
   ```

2. **Rate Limiting:**
   ```javascript
   // Consider adding rate limiting
   const rateLimit = require('express-rate-limit');
   app.use('/commands', rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 10 // 10 requests per minute
   }));
   ```

3. **Logging:**
   ```javascript
   // Log security-relevant events
   logger.info('Command queued', {
     command: cmd.substring(0, 50),
     from: deviceName,
     ip: req.ip
   });
   ```

### For Production

1. **Use SSH Tunnel:**
   - More reliable than localtunnel
   - Full control over access
   - Better encryption

2. **Enable HTTPS:**
   - Configure nginx with SSL
   - Use Let's Encrypt for certificates

3. **Monitor Logs:**
   - Watch for unauthorized attempts
   - Alert on unusual activity
   - Review command history

## Incident Response

### Suspected Compromise

1. **Immediate Actions:**
   ```bash
   # Stop server
   ./scripts/stop-server.js

   # Clear state
   rm -rf ~/.claude/remote-bridge/*
   ```

2. **Investigation:**
   - Review `/tmp/remote-bridge.log`
   - Check command history
   - Look for unusual activity

3. **Recovery:**
   - Restart with new API key
   - Review session security
   - Consider network changes

### Reporting Issues

Report security issues:
- GitHub Security Advisories
- Email to maintainer
- Don't disclose publicly before fix

## Compliance

### Data Handling

- No personal data collected
- No telemetry or analytics
- All data stays local

### Open Source

- Code is auditable
- MIT license
- Community reviewed

## See Also

- [Architecture](ARCHITECTURE.md) - System design
- [Tunneling](TUNNELING.md) - Network options
- [Privacy](PRIVACY.md) - Privacy policy
- [Debugging](DEBUGGING.md) - Log analysis
