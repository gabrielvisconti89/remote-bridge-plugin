# Remote Bridge Skill

Node.js server that exposes functionality for remote control via HTTP and WebSocket.

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Available variables:

| Variable | Default | Description |
|----------|---------|-------------|
| SKILL_PORT | 3000 | Server port |
| SKILL_HOST | 0.0.0.0 | Binding host |
| SKILL_LOG_LEVEL | info | Log level (debug, info, warn, error) |
| SKILL_API_KEY | - | API key (optional) |
| SKILL_MAX_FILE_SIZE | 10485760 | Maximum file size (10MB) |
| SKILL_COMMAND_TIMEOUT | 30000 | Command timeout (30s) |

## Usage

### Start

```bash
npm start
```

### Development (auto-reload)

```bash
npm run dev
```

### Automated setup

```bash
npm run setup
```

## API Endpoints

### Health Check

```bash
GET /health
```

### System

```bash
GET /system/info      # System information
GET /system/status    # Server status
GET /system/load      # Load averages
GET /system/network   # Network interfaces
```

### Files

```bash
GET /file/read?path=/path        # Read file
GET /file/list?path=/path        # List directory
GET /file/exists?path=/path      # Check existence
POST /file/write                 # Write file
DELETE /file/delete?path=/path   # Delete file
```

### Shell

```bash
POST /shell/exec     # Execute command
POST /shell/stream   # Execute with streaming (WebSocket)
GET /shell/processes # List active processes
POST /shell/kill     # Kill process
```

## WebSocket

Connect to `ws://localhost:3000` for real-time communication.

### Messages

```json
// Ping
{ "type": "ping" }

// Command
{
  "type": "command",
  "action": "shell.exec",
  "payload": { "command": "ls -la" }
}

// Broadcast
{
  "type": "broadcast",
  "payload": { "message": "Hello" }
}
```

## Structure

```
skill/
├── server.js          # Main server
├── setup.js           # Installation script
├── handlers/
│   ├── index.js       # Handler aggregator
│   ├── file.js        # File operations
│   ├── shell.js       # Command execution
│   └── system.js      # System info
└── utils/
    ├── config.js      # Configuration
    └── logger.js      # Logging system
```

## Security

- Use `SKILL_API_KEY` to protect endpoints
- Do not expose on public networks without HTTPS
- Configure firewall appropriately
