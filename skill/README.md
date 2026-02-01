# Remote Bridge Skill

Servidor Node.js que expoe funcionalidades para controle remoto via HTTP e WebSocket.

## Instalacao

```bash
npm install
```

## Configuracao

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Variaveis disponiveis:

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| SKILL_PORT | 3000 | Porta do servidor |
| SKILL_HOST | 0.0.0.0 | Host de binding |
| SKILL_LOG_LEVEL | info | Nivel de log (debug, info, warn, error) |
| SKILL_API_KEY | - | Chave de API (opcional) |
| SKILL_MAX_FILE_SIZE | 10485760 | Tamanho maximo de arquivo (10MB) |
| SKILL_COMMAND_TIMEOUT | 30000 | Timeout de comandos (30s) |

## Uso

### Iniciar

```bash
npm start
```

### Desenvolvimento (auto-reload)

```bash
npm run dev
```

### Setup automatizado

```bash
npm run setup
```

## API Endpoints

### Health Check

```bash
GET /health
```

### Sistema

```bash
GET /system/info      # Informacoes do sistema
GET /system/status    # Status do servidor
GET /system/load      # Load averages
GET /system/network   # Interfaces de rede
```

### Arquivos

```bash
GET /file/read?path=/caminho    # Ler arquivo
GET /file/list?path=/caminho    # Listar diretorio
GET /file/exists?path=/caminho  # Verificar existencia
POST /file/write                # Escrever arquivo
DELETE /file/delete?path=/caminho  # Deletar arquivo
```

### Shell

```bash
POST /shell/exec     # Executar comando
POST /shell/stream   # Executar com streaming (WebSocket)
GET /shell/processes # Listar processos ativos
POST /shell/kill     # Matar processo
```

## WebSocket

Conecte em `ws://localhost:3000` para comunicacao em tempo real.

### Mensagens

```json
// Ping
{ "type": "ping" }

// Comando
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

## Estrutura

```
skill/
├── server.js          # Servidor principal
├── setup.js           # Script de instalacao
├── handlers/
│   ├── index.js       # Agregador de handlers
│   ├── file.js        # Operacoes de arquivo
│   ├── shell.js       # Execucao de comandos
│   └── system.js      # Info do sistema
└── utils/
    ├── config.js      # Configuracao
    └── logger.js      # Sistema de logs
```

## Seguranca

- Use `SKILL_API_KEY` para proteger endpoints
- Nao exponha em redes publicas sem HTTPS
- Configure firewall adequadamente
