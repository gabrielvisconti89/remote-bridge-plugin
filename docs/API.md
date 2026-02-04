# Remote Bridge Plugin - API Reference

## Base URL

```
Local:  http://localhost:3000
Tunnel: https://{random}.loca.lt
```

## Authentication

Todas as requisições requerem autenticação via header:

```
X-API-Key: {sua-api-key}
```

A API key é gerada automaticamente no startup do servidor e exibida no terminal.

---

## Health Check

### GET /health

Verifica se o servidor está funcionando.

**Request:**
```bash
curl http://localhost:3000/health \
  -H "X-API-Key: {api-key}"
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T14:20:37.123Z",
  "uptime": 3600.5
}
```

---

## Status Broadcast

### POST /status

Envia uma mensagem de status para todos os clientes WebSocket conectados.

**Request:**
```bash
curl -X POST http://localhost:3000/status \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Processing your request...",
    "type": "thinking"
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| message | string | Sim | Mensagem a enviar |
| type | string | Não | Tipo: `thinking`, `working`, `done` (default: `thinking`) |

**Response (200):**
```json
{
  "success": true,
  "sent": 2
}
```

### DELETE /status

Limpa o status em todos os clientes conectados.

**Request:**
```bash
curl -X DELETE http://localhost:3000/status \
  -H "X-API-Key: {api-key}"
```

**Response (200):**
```json
{
  "success": true,
  "sent": 2
}
```

---

## Shell Commands

### POST /shell/exec

Executa um comando no shell e retorna o resultado.

**Request:**
```bash
curl -X POST http://localhost:3000/shell/exec \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ls -la",
    "cwd": "/home/user",
    "timeout": 30000
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| command | string | Sim | Comando a executar |
| cwd | string | Não | Diretório de trabalho (default: cwd do servidor) |
| timeout | number | Não | Timeout em ms (default: 30000) |

**Response (200):**
```json
{
  "success": true,
  "processId": 1,
  "command": "ls -la",
  "code": 0,
  "signal": null,
  "stdout": "total 64\ndrwxr-xr-x  10 user  staff   320 Jan 31 14:20 .\n...",
  "stderr": "",
  "duration": 45
}
```

**Response (500) - Erro:**
```json
{
  "success": false,
  "processId": 1,
  "command": "invalid-command",
  "error": "Command failed: invalid-command",
  "duration": 12
}
```

### POST /shell/stream

Executa um comando com streaming de output via WebSocket.

**Request:**
```bash
curl -X POST http://localhost:3000/shell/stream \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "npm install",
    "clientId": 1
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| command | string | Sim | Comando a executar |
| clientId | number | Sim | ID do cliente WebSocket que receberá o streaming |
| cwd | string | Não | Diretório de trabalho |
| timeout | number | Não | Timeout em ms |

**Response (200):**
```json
{
  "success": true,
  "processId": 2,
  "command": "npm install",
  "pid": 12345,
  "message": "Command started, output will be streamed via WebSocket"
}
```

**WebSocket Messages:**
```json
// Início
{ "type": "shell.started", "processId": 2, "command": "npm install", "pid": 12345 }

// Stdout (múltiplas mensagens)
{ "type": "shell.stdout", "processId": 2, "data": "npm WARN ..." }

// Stderr
{ "type": "shell.stderr", "processId": 2, "data": "npm ERR! ..." }

// Conclusão
{ "type": "shell.completed", "processId": 2, "code": 0, "signal": null, "duration": 5432 }
```

### POST /shell/type

Digita um comando diretamente na janela do terminal (útil para CLIs interativas).

**Request:**
```bash
curl -X POST http://localhost:3000/shell/type \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "git status",
    "submit": true
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| command | string | Sim | Comando a digitar |
| submit | boolean | Não | Pressionar Enter após digitar (default: true) |

**Response (200):**
```json
{
  "success": true,
  "command": "git status",
  "submitted": true,
  "platform": "darwin",
  "app": "iTerm2",
  "message": "Command typed to iTerm2"
}
```

**Response (501) - Plataforma não suportada:**
```json
{
  "success": false,
  "error": "Platform not supported",
  "message": "Typing mode is not supported on freebsd",
  "supportedPlatforms": ["darwin (macOS)", "linux", "win32 (Windows)"]
}
```

**Response (500) - Erro no Linux:**
```json
{
  "success": false,
  "error": "xdotool not installed",
  "details": "Install xdotool: sudo apt-get install xdotool (Debian/Ubuntu) or sudo dnf install xdotool (Fedora)"
}
```

### POST /shell/message

Queue a command with optional image attachment (multipart/form-data). This is the recommended endpoint for mobile apps to send messages with images.

**Request:**
```bash
# With image
curl -X POST http://localhost:3000/shell/message \
  -H "X-API-Key: {api-key}" \
  -F "command=Analyze this bug screenshot" \
  -F "deviceName=iPhone 15" \
  -F "image=@screenshot.jpg"

# Without image
curl -X POST http://localhost:3000/shell/message \
  -H "X-API-Key: {api-key}" \
  -F "command=git status" \
  -F "deviceName=iPhone 15"
```

**Form Fields:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| command | string | Sim | Command or message for Claude |
| deviceName | string | Não | Name of the device (default: "Mobile App") |
| image | file | Não | Image file (jpg, png, gif, webp, max 10MB) |

**Response (200):**
```json
{
  "success": true,
  "queued": true,
  "id": "cmd_abc123def456",
  "command": "Analyze this bug screenshot",
  "from": "iPhone 15",
  "receivedAt": "2026-02-04T12:00:00.000Z",
  "attachment": {
    "id": "img_xyz789abc012",
    "originalName": "screenshot.jpg"
  },
  "message": "Message queued successfully. Run /remote-bridge:inbox to execute."
}
```

**Response (without image):**
```json
{
  "success": true,
  "queued": true,
  "id": "cmd_abc123def456",
  "command": "git status",
  "from": "iPhone 15",
  "receivedAt": "2026-02-04T12:00:00.000Z",
  "attachment": null,
  "message": "Message queued successfully. Run /remote-bridge:inbox to execute."
}
```

**Command Queue Entry (with attachment):**
```json
{
  "id": "cmd_abc123def456",
  "command": "Analyze this bug screenshot",
  "receivedAt": "2026-02-04T12:00:00.000Z",
  "from": "iPhone 15",
  "status": "pending",
  "attachment": {
    "type": "image",
    "id": "img_xyz789abc012",
    "path": "/Users/.../.claude/remote-bridge/uploads/img_xyz789abc012.jpg",
    "originalName": "screenshot.jpg",
    "size": 123456
  }
}
```

### GET /shell/processes

Lista processos ativos iniciados pelo servidor.

**Request:**
```bash
curl http://localhost:3000/shell/processes \
  -H "X-API-Key: {api-key}"
```

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "processes": [
    {
      "processId": 1,
      "pid": 12345,
      "command": "npm install",
      "startTime": "2026-01-31T14:20:00.000Z",
      "duration": 5000,
      "clientId": 1
    },
    {
      "processId": 2,
      "pid": 12346,
      "command": "webpack --watch",
      "startTime": "2026-01-31T14:20:30.000Z",
      "duration": 2000,
      "clientId": null
    }
  ]
}
```

### POST /shell/kill

Mata um processo ativo.

**Request (por processId):**
```bash
curl -X POST http://localhost:3000/shell/kill \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "processId": 1,
    "signal": "SIGTERM"
  }'
```

**Request (por PID):**
```bash
curl -X POST http://localhost:3000/shell/kill \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": 12345,
    "signal": "SIGKILL"
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| processId | number | Condicional | ID interno do processo |
| pid | number | Condicional | PID do sistema operacional |
| signal | string | Não | Sinal a enviar (default: SIGTERM) |

**Response (200):**
```json
{
  "success": true,
  "processId": 1,
  "signal": "SIGTERM"
}
```

---

## File Operations

### GET /file/read

Lê o conteúdo de um arquivo.

**Request:**
```bash
curl "http://localhost:3000/file/read?path=/home/user/file.txt" \
  -H "X-API-Key: {api-key}"
```

**Query Parameters:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| path | string | Sim | Caminho absoluto do arquivo |
| encoding | string | Não | Encoding (default: utf8) |

**Response (200):**
```json
{
  "success": true,
  "path": "/home/user/file.txt",
  "content": "File contents here...",
  "size": 1234,
  "encoding": "utf8"
}
```

### POST /file/write

Escreve conteúdo em um arquivo.

**Request:**
```bash
curl -X POST http://localhost:3000/file/write \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/user/file.txt",
    "content": "New content",
    "encoding": "utf8"
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| path | string | Sim | Caminho absoluto do arquivo |
| content | string | Sim | Conteúdo a escrever |
| encoding | string | Não | Encoding (default: utf8) |

**Response (200):**
```json
{
  "success": true,
  "path": "/home/user/file.txt",
  "size": 11
}
```

### GET /file/list

Lista arquivos e diretórios.

**Request:**
```bash
curl "http://localhost:3000/file/list?path=/home/user" \
  -H "X-API-Key: {api-key}"
```

**Query Parameters:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| path | string | Sim | Caminho do diretório |

**Response (200):**
```json
{
  "success": true,
  "path": "/home/user",
  "entries": [
    {
      "name": "Documents",
      "type": "directory",
      "size": 0
    },
    {
      "name": "file.txt",
      "type": "file",
      "size": 1234
    }
  ]
}
```

---

## System Information

### GET /system/info

Retorna informações do sistema.

**Request:**
```bash
curl http://localhost:3000/system/info \
  -H "X-API-Key: {api-key}"
```

**Response (200):**
```json
{
  "success": true,
  "system": {
    "platform": "darwin",
    "arch": "arm64",
    "hostname": "MacBook-Pro.local",
    "release": "23.0.0",
    "uptime": 86400,
    "loadavg": [1.5, 1.2, 1.0],
    "totalmem": 17179869184,
    "freemem": 8589934592,
    "cpus": 10
  },
  "process": {
    "pid": 12345,
    "uptime": 3600,
    "memoryUsage": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 15728640
    },
    "cwd": "/Users/user/remote-bridge/skill"
  }
}
```

---

## WebSocket API

### Conexão

```javascript
const ws = new WebSocket('ws://localhost:3000?key={api-key}');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message:', data);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};
```

### Mensagens Recebidas

| Type | Descrição |
|------|-----------|
| `connected` | Confirmação de conexão |
| `pong` | Resposta a ping |
| `claude.status` | Status do Claude |
| `claude.status.clear` | Limpar status |
| `shell.started` | Comando iniciado |
| `shell.stdout` | Output stdout |
| `shell.stderr` | Output stderr |
| `shell.completed` | Comando completado |
| `shell.error` | Erro no comando |
| `broadcast` | Mensagem de outro cliente |
| `error` | Erro genérico |

### Mensagens Enviadas

```javascript
// Ping (heartbeat)
ws.send(JSON.stringify({ type: 'ping' }));

// Broadcast para outros clientes
ws.send(JSON.stringify({
  type: 'broadcast',
  payload: { message: 'Hello from client 1' }
}));
```

---

## Error Codes

| HTTP Code | Descrição |
|-----------|-----------|
| 200 | Sucesso |
| 400 | Bad Request - Parâmetros inválidos |
| 401 | Unauthorized - API key inválida ou ausente |
| 404 | Not Found - Endpoint ou recurso não encontrado |
| 500 | Internal Server Error - Erro no servidor |
| 501 | Not Implemented - Funcionalidade não suportada na plataforma |

### Formato de Erro

```json
{
  "error": "Error Name",
  "message": "Detailed error message"
}
```

---

## Rate Limits

Atualmente não há rate limiting implementado. Para uso em produção exposto publicamente, considere:

- Implementar rate limiting por IP
- Usar um reverse proxy (nginx, cloudflare)
- Limitar comandos por minuto

---

## Screenshot Operations

### POST /screenshot/capture

Trigger a screenshot capture or save a screenshot from file path.

**Request:**
```bash
curl -X POST http://localhost:3000/screenshot/capture \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "imagePath": "/path/to/screenshot.png"
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| imagePath | string | Não | Path to existing screenshot file |
| selector | string | Não | Element selector (for Playwright capture) |
| fullPage | boolean | Não | Capture full page (default: false) |

**Response (200):**
```json
{
  "success": true,
  "id": "scr_abc123def456",
  "path": "/Users/.../screenshots/scr_abc123def456.png",
  "url": "https://xxx.loca.lt/screenshot/scr_abc123def456",
  "size": 245760,
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### POST /screenshot/save

Save a screenshot from base64 encoded image data.

**Request:**
```bash
curl -X POST http://localhost:3000/screenshot/save \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "iVBORw0KGgo...",
    "format": "png"
  }'
```

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| imageData | string | Sim | Base64 encoded image |
| format | string | Não | Image format (default: png) |

**Response (200):**
```json
{
  "success": true,
  "id": "scr_abc123def456",
  "path": "/Users/.../screenshots/scr_abc123def456.png",
  "url": "https://xxx.loca.lt/screenshot/scr_abc123def456",
  "size": 245760,
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### GET /screenshot/latest

Get the most recent screenshot.

**Request:**
```bash
curl http://localhost:3000/screenshot/latest \
  -H "X-API-Key: {api-key}" \
  --output screenshot.png
```

**Response:** Binary PNG image

### GET /screenshot/:id

Get a specific screenshot by ID.

**Request:**
```bash
curl http://localhost:3000/screenshot/scr_abc123def456 \
  -H "X-API-Key: {api-key}" \
  --output screenshot.png
```

**Response:** Binary PNG image

### GET /screenshots

List all available screenshots.

**Request:**
```bash
curl http://localhost:3000/screenshot \
  -H "X-API-Key: {api-key}"
```

**Response (200):**
```json
{
  "success": true,
  "count": 5,
  "screenshots": [
    {
      "id": "scr_abc123def456",
      "path": "/Users/.../screenshots/scr_abc123def456.png",
      "url": "https://xxx.loca.lt/screenshot/scr_abc123def456",
      "size": 245760,
      "timestamp": "2026-02-02T12:00:00.000Z"
    }
  ]
}
```

### DELETE /screenshot/:id

Delete a specific screenshot.

**Request:**
```bash
curl -X DELETE http://localhost:3000/screenshot/scr_abc123def456 \
  -H "X-API-Key: {api-key}"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Screenshot deleted"
}
```

---

## Image Upload

### POST /screenshot/upload

Upload an image from mobile app for Claude to analyze.

**Request:**
```bash
curl -X POST http://localhost:3000/screenshot/upload \
  -H "X-API-Key: {api-key}" \
  -F "file=@photo.jpg"
```

**Response (200):**
```json
{
  "success": true,
  "id": "img_abc123def456",
  "path": "/Users/.../uploads/img_abc123def456.jpg",
  "size": 123456,
  "originalName": "photo.jpg",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "message": "Image uploaded and ready for Claude to analyze"
}
```

### GET /screenshot/image/:id

Get an uploaded image.

**Request:**
```bash
curl http://localhost:3000/screenshot/image/img_abc123def456 \
  -H "X-API-Key: {api-key}" \
  --output image.jpg
```

**Response:** Binary image

### GET /screenshot/images

List all uploaded images.

**Request:**
```bash
curl http://localhost:3000/screenshot/images \
  -H "X-API-Key: {api-key}"
```

**Response (200):**
```json
{
  "success": true,
  "count": 3,
  "images": [
    {
      "id": "img_abc123def456",
      "path": "/Users/.../uploads/img_abc123def456.jpg",
      "url": "https://xxx.loca.lt/screenshot/image/img_abc123def456",
      "size": 123456,
      "timestamp": "2026-02-02T12:00:00.000Z"
    }
  ]
}
```

---

## Exemplos

### Python

```python
import requests

API_KEY = "your-api-key"
BASE_URL = "http://localhost:3000"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Executar comando
response = requests.post(
    f"{BASE_URL}/shell/exec",
    headers=headers,
    json={"command": "ls -la"}
)
print(response.json())
```

### JavaScript (Node.js)

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

// Executar comando
const result = await api.post('/shell/exec', {
  command: 'ls -la'
});
console.log(result.data);
```

### cURL

```bash
# Definir variáveis
API_KEY="your-api-key"
HOST="http://localhost:3000"

# Health check
curl -H "X-API-Key: $API_KEY" $HOST/health

# Executar comando
curl -X POST $HOST/shell/exec \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "echo Hello World"}'

# Digitar no terminal
curl -X POST $HOST/shell/type \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "git status", "submit": true}'
```
