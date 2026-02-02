# Tunneling Options

Remote Bridge needs to be accessible from your mobile device. This document covers the available tunneling options.

## Overview

There are three ways to connect your mobile app to the Remote Bridge server:

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| Localtunnel | Quick setup, testing | Free, automatic | Rate limits, temporary URLs |
| SSH Tunnel | Production, reliability | Stable, secure | Requires server |
| Local Network | Same network | Direct, fast | Limited to LAN |

## 1. Localtunnel (Default)

Remote Bridge uses [localtunnel](https://localtunnel.github.io/www/) by default to create a public URL.

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │────▶│  localtunnel│────▶│   Plugin    │
│    App      │     │   servers   │     │   Server    │
│             │◀────│             │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
     Internet            Cloud           localhost:3000
```

1. Server starts on `localhost:3000`
2. Localtunnel creates tunnel to `https://xxx.loca.lt`
3. Mobile app connects to the public URL
4. Traffic forwarded to local server

### URL Format

```
https://{random-subdomain}.loca.lt
```

Example: `https://brave-owl-42.loca.lt`

### Configuration

No configuration needed. Localtunnel starts automatically when server starts.

### First-Time Access

When first accessing a localtunnel URL, you may see a bypass page. The app handles this automatically, but you may need to:

1. Open the URL in a browser
2. Click "Click to Continue"
3. App will work after bypass

### Limitations

- **Rate Limits:** Free service has rate limits
- **Temporary URLs:** URL changes on each server restart
- **Reliability:** Service may have occasional downtime
- **Performance:** Additional latency from tunnel

### Troubleshooting

```bash
# Check tunnel status
curl https://xxx.loca.lt/health -H "bypass-tunnel-reminder: true"

# View server logs for tunnel errors
tail -f /tmp/remote-bridge.log | grep tunnel
```

## 2. SSH Reverse Tunnel

For production use or when localtunnel is unreliable, use an SSH reverse tunnel.

### Requirements

- VPS or server with SSH access
- Public domain or IP address
- SSH key authentication (recommended)

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │────▶│   Your      │────▶│   Plugin    │
│    App      │     │   VPS       │     │   Server    │
│             │◀────│   (SSH)     │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
     Internet         your-server.com    localhost:3000
```

1. SSH tunnel established from local machine to VPS
2. VPS listens on port 80/443
3. Traffic forwarded through tunnel to local server

### Setup

#### Step 1: Configure VPS

Edit `/etc/ssh/sshd_config`:

```
GatewayPorts yes
AllowTcpForwarding yes
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

#### Step 2: Create Tunnel

```bash
# Basic tunnel (HTTP on port 80)
ssh -R 80:localhost:3000 user@your-server.com

# HTTPS with nginx (recommended)
ssh -R 8080:localhost:3000 user@your-server.com
```

#### Step 3: Keep Tunnel Alive

Use `autossh` for automatic reconnection:

```bash
# Install autossh
brew install autossh  # macOS
apt install autossh   # Debian/Ubuntu

# Create persistent tunnel
autossh -M 0 -f -N -R 80:localhost:3000 user@your-server.com
```

### HTTPS with nginx

For HTTPS, configure nginx on your VPS:

```nginx
server {
    listen 443 ssl;
    server_name bridge.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Advantages

- **Stable URL:** Same URL every time
- **Reliable:** No third-party service dependency
- **Secure:** Encrypted tunnel, controlled access
- **Performance:** Direct connection, lower latency

### Future Plugin Support

SSH tunnel configuration may be added to the plugin:

```json
{
  "tunnel": {
    "type": "ssh",
    "host": "your-server.com",
    "user": "username",
    "remotePort": 80,
    "keepAlive": true
  }
}
```

## 3. Local Network Connection

When mobile device and computer are on the same network.

### How It Works

```
┌─────────────┐     ┌─────────────┐
│   Mobile    │────▶│   Plugin    │
│    App      │     │   Server    │
│             │◀────│             │
└─────────────┘     └─────────────┘
    192.168.1.x     192.168.1.y:3000
```

Direct connection via local IP address.

### Setup

#### Step 1: Find Local IP

```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# Linux
ip addr | grep "inet " | grep -v 127.0.0.1
```

Example: `192.168.1.100`

#### Step 2: Configure App

In mobile app settings:
- Host: `192.168.1.100`
- Port: `3000`
- SSL: Off

#### Step 3: Allow Firewall

```bash
# macOS (if using firewall)
# Add Terminal or node to allowed apps

# Linux (ufw)
sudo ufw allow 3000
```

### Advantages

- **No Internet Required:** Works offline
- **Fastest:** Direct connection
- **Simple:** No tunnel configuration

### Limitations

- **Same Network:** Must be on same WiFi/LAN
- **No HTTPS:** Traffic not encrypted (use for trusted networks only)
- **IP Changes:** May need to update app when IP changes

### Security Note

Local network connections are not encrypted. Only use on trusted networks. For untrusted networks, use localtunnel or SSH tunnel.

## Comparison Table

| Feature | Localtunnel | SSH Tunnel | Local Network |
|---------|-------------|------------|---------------|
| Setup Time | Instant | 10-30 min | 5 min |
| Cost | Free | VPS cost | Free |
| URL Stability | Changes | Permanent | IP may change |
| Reliability | Variable | High | High |
| Performance | Good | Best | Best |
| Security | HTTPS | HTTPS | None |
| Internet | Required | Required | Not required |
| Requirements | None | VPS | Same network |

## Recommendations

- **Development/Testing:** Localtunnel (quick and easy)
- **Production:** SSH Tunnel (stable and secure)
- **Home Use:** Local Network (simple and fast)

## Troubleshooting

### Connection Refused

1. Check server is running: `curl http://localhost:3000/health`
2. Check firewall allows port 3000
3. Verify tunnel is established

### Slow Connection

1. Check network latency: `ping your-server.com`
2. Consider switching to local network
3. Use SSH tunnel for better performance

### Tunnel Drops

1. Use `autossh` for automatic reconnection
2. Add keep-alive to SSH: `ServerAliveInterval 60`
3. Check server load and memory

## See Also

- [Architecture](ARCHITECTURE.md) - System design
- [Security](SECURITY.md) - Security considerations
- [Debugging](DEBUGGING.md) - Troubleshooting guide
