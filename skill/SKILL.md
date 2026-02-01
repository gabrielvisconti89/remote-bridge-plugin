# Remote Bridge Skill

## Description

Skill for Claude Code that exposes an HTTP/WebSocket server for remote device control. Allows executing commands, manipulating files, and monitoring the system through a mobile app or any HTTP/WS client.

## When to Use

- When you need to control a machine remotely via mobile app
- When you need to execute shell commands remotely
- When you need to transfer files between devices
- When you need to monitor system resources remotely

## Dependencies

- Node.js 18+
- npm packages: express, ws, cors, dotenv

## Configuration

Copy `.env.example` to `.env` and configure:

```env
SKILL_PORT=3000        # Server port
SKILL_HOST=0.0.0.0     # Host (0.0.0.0 to accept external connections)
SKILL_LOG_LEVEL=info   # Log level: debug, info, warn, error
```

## Usage

### Start Server

```bash
cd skill
npm install
npm start
```

### HTTP Endpoints

#### GET /health
Check server status.

```bash
curl http://localhost:3000/health
```

#### GET /system/info
Return system information.

```bash
curl http://localhost:3000/system/info
```

#### POST /shell/exec
Execute shell command.

```bash
curl -X POST http://localhost:3000/shell/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

#### GET /file/read
Read file content.

```bash
curl "http://localhost:3000/file/read?path=/path/to/file"
```

#### POST /file/write
Write content to file.

```bash
curl -X POST http://localhost:3000/file/write \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/file", "content": "content"}'
```

#### GET /file/list
List directory.

```bash
curl "http://localhost:3000/file/list?path=/path/to/dir"
```

### WebSocket

Connect to `ws://localhost:3000` for real-time communication.

#### Messages

JSON format:
```json
{
  "type": "command",
  "action": "shell.exec",
  "payload": { "command": "ls -la" }
}
```

Message types:
- `command`: Execute action
- `subscribe`: Subscribe to events
- `ping`: Heartbeat

## Examples

### Execute command and receive streaming output

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'command',
    action: 'shell.exec',
    payload: { command: 'npm install', stream: true }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.output);
};
```

### Monitor system resources

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  action: 'system.monitor',
  payload: { interval: 5000 }
}));
```

## Limitations

- Does not support advanced authentication (only optional API key)
- Does not support HTTPS natively (use reverse proxy)
- Shell commands have configurable timeout (default 30s)
- Maximum file size is configurable (default 10MB)
- Does not support interactive command execution (e.g., vim, nano)
