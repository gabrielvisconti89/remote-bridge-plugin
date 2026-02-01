# Remote Bridge Skill

## Descricao

Skill para Claude Code que expoe um servidor HTTP/WebSocket para controle remoto de dispositivos. Permite executar comandos, manipular arquivos e monitorar o sistema atraves de um app mobile ou qualquer cliente HTTP/WS.

## Quando Usar

- Quando precisar controlar uma maquina remotamente via app mobile
- Quando precisar executar comandos shell de forma remota
- Quando precisar transferir arquivos entre dispositivos
- Quando precisar monitorar recursos do sistema remotamente

## Dependencias

- Node.js 18+
- npm packages: express, ws, cors, dotenv

## Configuracao

Copie `.env.example` para `.env` e configure:

```env
SKILL_PORT=3000        # Porta do servidor
SKILL_HOST=0.0.0.0     # Host (0.0.0.0 para aceitar conexoes externas)
SKILL_LOG_LEVEL=info   # Nivel de log: debug, info, warn, error
```

## Uso

### Iniciar Servidor

```bash
cd skill
npm install
npm start
```

### Endpoints HTTP

#### GET /health
Verifica status do servidor.

```bash
curl http://localhost:3000/health
```

#### GET /system/info
Retorna informacoes do sistema.

```bash
curl http://localhost:3000/system/info
```

#### POST /shell/exec
Executa comando no shell.

```bash
curl -X POST http://localhost:3000/shell/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

#### GET /file/read
Le conteudo de arquivo.

```bash
curl "http://localhost:3000/file/read?path=/path/to/file"
```

#### POST /file/write
Escreve conteudo em arquivo.

```bash
curl -X POST http://localhost:3000/file/write \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/file", "content": "conteudo"}'
```

#### GET /file/list
Lista diretorio.

```bash
curl "http://localhost:3000/file/list?path=/path/to/dir"
```

### WebSocket

Conecte em `ws://localhost:3000` para comunicacao em tempo real.

#### Mensagens

Formato JSON:
```json
{
  "type": "command",
  "action": "shell.exec",
  "payload": { "command": "ls -la" }
}
```

Tipos de mensagem:
- `command`: Executa acao
- `subscribe`: Inscreve em eventos
- `ping`: Heartbeat

## Exemplos

### Executar comando e receber output em streaming

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

### Monitorar recursos do sistema

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  action: 'system.monitor',
  payload: { interval: 5000 }
}));
```

## Limitacoes

- Nao suporta autenticacao avancada (apenas API key opcional)
- Nao suporta HTTPS nativamente (use proxy reverso)
- Comandos shell tem timeout configuravel (padrao 30s)
- Tamanho maximo de arquivo configuravel (padrao 10MB)
- Nao suporta execucao de comandos interativos (ex: vim, nano)
