# Claude Bridge - Documentação Técnica

## Visão Geral

**Claude Bridge** é um sistema de controle remoto que permite enviar comandos para o Claude Code a partir de dispositivos móveis. O sistema é composto por três componentes principais que se comunicam via HTTP REST e WebSocket.

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USUÁRIO MÓVEL                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Internet / LAN
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MOBILE APP (Ionic/Angular)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Connections │  │    Chat     │  │   Skill     │  │  Settings   │        │
│  │   Module    │  │   Module    │  │   Module    │  │   Module    │        │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └──────┬──────┘        │
│         │                │                                  │               │
│         └────────────────┼──────────────────────────────────┘               │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         CORE SERVICES                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │ ApiService  │  │ WebSocket   │  │  Storage    │  │   Theme     │   │  │
│  │  │             │  │  Service    │  │  Service    │  │  Service    │   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────────┘   │  │
│  └─────────┼────────────────┼────────────────────────────────────────────┘  │
└────────────┼────────────────┼───────────────────────────────────────────────┘
             │                │
             │ HTTP REST      │ WebSocket
             │                │
             ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SKILL SERVER (Node.js)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           EXPRESS APP                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │  │
│  │  │   CORS      │  │  API Key    │  │   Logger    │    Middlewares     │  │
│  │  │ Middleware  │  │   Auth      │  │ Middleware  │                    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            HANDLERS                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │  │
│  │  │   Shell     │  │    File     │  │   System    │                    │  │
│  │  │  Handler    │  │   Handler   │  │   Handler   │                    │  │
│  │  │             │  │             │  │             │                    │  │
│  │  │ /shell/exec │  │ /file/read  │  │ /health     │                    │  │
│  │  │ /shell/type │  │ /file/write │  │ /system/info│                    │  │
│  │  │ /shell/kill │  │ /file/list  │  │             │                    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         WEBSOCKET SERVER                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │  │
│  │  │  Connected  │  │  Heartbeat  │  │  Broadcast  │                    │  │
│  │  │   Clients   │  │   Manager   │  │   Manager   │                    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          LOCALTUNNEL                                   │  │
│  │         Cria URL pública temporária (https://xxx.loca.lt)              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
             │
             │ Execução local
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SISTEMA OPERACIONAL                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │   Shell     │  │ File System │  │  Terminal   │                          │
│  │  (bash/zsh) │  │             │  │ (AppleScript│                          │
│  │             │  │             │  │  /xdotool)  │                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Componentes Detalhados

### 1. Mobile App (Ionic/Angular)

#### Estrutura de Módulos

```
app/src/app/
├── core/                      # Singleton services
│   ├── models/
│   │   ├── connection.model.ts   # Interface de conexão
│   │   └── message.model.ts      # Interface de mensagem
│   └── services/
│       ├── api.service.ts        # Cliente HTTP REST
│       ├── websocket.service.ts  # Cliente WebSocket
│       ├── storage.service.ts    # Ionic Storage wrapper
│       ├── chat-state.service.ts # Estado do chat
│       ├── connection-manager.service.ts # Gerencia conexões
│       └── theme.service.ts      # Tema dark/light
│
├── features/                  # Feature modules (lazy loaded)
│   ├── connection/            # Gerenciamento de conexões
│   │   ├── pages/
│   │   │   ├── connection-list/  # Lista de conexões
│   │   │   └── connection-add/   # Adicionar conexão
│   │   └── services/
│   │       └── connection.service.ts
│   │
│   ├── chat/                  # Interface de comandos
│   │   ├── components/
│   │   │   ├── command-input/    # Input de comando
│   │   │   └── message-bubble/   # Balão de mensagem
│   │   └── pages/
│   │       └── chat-main/        # Página principal
│   │
│   ├── skill/                 # Guia de instalação
│   │   └── pages/
│   │       └── skill-main/
│   │
│   └── settings/              # Configurações
│       └── pages/
│           └── settings-main/
│
├── tabs/                      # Navegação por tabs
│   ├── tabs.page.ts
│   └── tabs-routing.module.ts
│
└── shared/                    # Componentes compartilhados
    ├── components/
    └── pipes/
```

#### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                        COMPONENT                                 │
│                     (chat-main.page.ts)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. User types command
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CHAT STATE SERVICE                           │
│  - messages: BehaviorSubject<Message[]>                         │
│  - currentConnection: BehaviorSubject<Connection>               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 2. sendCommand()
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API SERVICE                                │
│  POST /shell/exec   OR   POST /shell/type                       │
│  Headers: X-API-Key: {apiKey}                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 3. HTTP Response
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CHAT STATE SERVICE                           │
│  - Adiciona mensagem de resposta                                │
│  - Persiste no Storage                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 4. Observable emits
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        COMPONENT                                 │
│  - Atualiza UI com nova mensagem                                │
│  - Auto-scroll para o final                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Skill Server (Node.js)

#### Estrutura de Arquivos

```
skill/
├── server.js              # Entry point, Express + WebSocket setup
├── package.json           # Dependências e scripts
├── .env.example           # Template de configuração
│
├── handlers/              # Route handlers
│   ├── index.js           # Registra todos os handlers
│   ├── shell.js           # Comandos shell e typing
│   ├── file.js            # Operações de arquivo
│   └── system.js          # Info do sistema
│
└── utils/                 # Utilitários
    ├── config.js          # Carrega e valida config
    └── logger.js          # Winston logger
```

#### Ciclo de Vida do Servidor

```
┌─────────────────────────────────────────────────────────────────┐
│                         STARTUP                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Load config (utils/config.js)                               │
│     - PORT, HOST, API_KEY, LOG_LEVEL                            │
│     - Auto-generate API_KEY if not set                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Create Express app                                          │
│     - CORS middleware (allow all origins)                       │
│     - JSON body parser (10MB limit)                             │
│     - HTTP logging middleware                                    │
│     - API key authentication middleware                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Register handlers                                           │
│     - /health, /status (system.js)                              │
│     - /shell/* (shell.js)                                       │
│     - /file/* (file.js)                                         │
│     - /system/* (system.js)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Create HTTP server                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Attach WebSocket server                                     │
│     - Handle connections                                         │
│     - Validate API key from query param                         │
│     - Start heartbeat interval (30s)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Start listening on PORT                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Create localtunnel                                          │
│     - Connect to loca.lt service                                │
│     - Receive public URL                                         │
│     - Display connection info                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RUNNING                                     │
│  - Accept HTTP requests                                          │
│  - Accept WebSocket connections                                  │
│  - Process commands                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SIGTERM/SIGINT
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SHUTDOWN                                    │
│  - Close WebSocket connections (1001: Server shutting down)     │
│  - Close HTTP server                                             │
│  - Exit process                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Typing Mode (Cross-Platform)

O Typing Mode permite digitar comandos diretamente na janela do terminal, em vez de executá-los via subprocess. Isso é útil para interagir com CLIs interativas como o Claude Code.

#### macOS (AppleScript)

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /shell/type { command: "ls -la", submit: true }           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Detectar terminal (TERM_PROGRAM, ITERM_SESSION_ID)             │
│  → iTerm2 ou Terminal.app                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  iTerm2:                                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ tell application "iTerm2"                                   ││
│  │   activate                                                   ││
│  │   tell current session of current tab of current window     ││
│  │     write text "ls -la"                                     ││
│  │   end tell                                                   ││
│  │ end tell                                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Terminal.app:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ tell application "Terminal" to activate                     ││
│  │ delay 0.3                                                    ││
│  │ tell application "System Events"                            ││
│  │   keystroke "ls -la"                                        ││
│  │   keystroke return                                           ││
│  │ end tell                                                     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  spawn('osascript', ['-e', script])                             │
│  → Executa AppleScript                                           │
│  → Retorna sucesso/erro                                          │
└─────────────────────────────────────────────────────────────────┘
```

#### Linux (xdotool)

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /shell/type { command: "ls -la", submit: true }           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Verificar xdotool: which xdotool                               │
│  Se não instalado → erro com instruções                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  execSync('xdotool type --clearmodifiers "ls -la"')             │
│  execSync('xdotool key Return')  // se submit=true              │
└─────────────────────────────────────────────────────────────────┘
```

#### Windows (PowerShell SendKeys)

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /shell/type { command: "ls -la", submit: true }           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Script PowerShell:                                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Add-Type -AssemblyName System.Windows.Forms                 ││
│  │ [System.Windows.Forms.SendKeys]::SendWait("ls -la")         ││
│  │ [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  spawn('powershell', ['-Command', script])                      │
└─────────────────────────────────────────────────────────────────┘
```

## Protocolos de Comunicação

### HTTP REST API

Todas as requisições HTTP requerem o header `X-API-Key` com a chave de autenticação.

#### Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| POST | `/status` | Broadcast status para clientes WS |
| DELETE | `/status` | Limpar status |
| GET | `/system/info` | Informações do sistema |
| POST | `/shell/exec` | Executar comando |
| POST | `/shell/stream` | Executar com streaming via WS |
| POST | `/shell/type` | Digitar no terminal |
| POST | `/shell/kill` | Matar processo |
| GET | `/shell/processes` | Listar processos ativos |
| GET | `/file/read` | Ler arquivo |
| POST | `/file/write` | Escrever arquivo |
| GET | `/file/list` | Listar diretório |

### WebSocket Protocol

Conexão: `ws://host:port?key={API_KEY}`

#### Mensagens do Servidor → Cliente

```typescript
// Conexão estabelecida
{
  type: 'connected',
  clientId: number,
  message: 'Welcome to Remote Bridge',
  timestamp: string  // ISO 8601
}

// Status do Claude (broadcast)
{
  type: 'claude.status',
  message: string,
  statusType: 'thinking' | 'working' | 'done',
  timestamp: string
}

// Limpar status
{
  type: 'claude.status.clear',
  timestamp: string
}

// Streaming de comando iniciado
{
  type: 'shell.started',
  processId: number,
  command: string,
  pid: number
}

// Streaming stdout
{
  type: 'shell.stdout',
  processId: number,
  data: string
}

// Streaming stderr
{
  type: 'shell.stderr',
  processId: number,
  data: string
}

// Comando completado
{
  type: 'shell.completed',
  processId: number,
  code: number,
  signal: string | null,
  duration: number  // ms
}

// Erro no comando
{
  type: 'shell.error',
  processId: number,
  error: string
}
```

#### Mensagens do Cliente → Servidor

```typescript
// Ping (heartbeat)
{
  type: 'ping'
}

// Broadcast para outros clientes
{
  type: 'broadcast',
  payload: any
}
```

## Persistência de Dados

### App (Ionic Storage)

```typescript
// Conexões salvas
interface Connection {
  id: string;           // UUID
  name: string;
  host: string;
  port: number;
  useSSL: boolean;
  apiKey?: string;
  lastConnected?: Date;
}

// Mensagens por conexão
interface Message {
  id: string;
  connectionId: string;
  type: 'user' | 'system' | 'response' | 'error';
  content: string;
  timestamp: Date;
  metadata?: {
    duration?: number;
    exitCode?: number;
  };
}

// Configurações
interface Settings {
  theme: 'light' | 'dark' | 'system';
  commandTimeout: number;      // ms
  autoReconnect: boolean;
  messageHistoryLimit: number;
  typingMode: boolean;
}
```

### Storage Keys

| Key | Tipo | Descrição |
|-----|------|-----------|
| `connections` | Connection[] | Lista de conexões |
| `messages_{connectionId}` | Message[] | Mensagens por conexão |
| `settings` | Settings | Configurações do app |
| `activeConnectionId` | string | ID da conexão ativa |

## Segurança

### Autenticação

1. **API Key**: Gerada automaticamente no startup do servidor (32 caracteres hex)
2. **Validação**: Todas as requisições HTTP verificam header `X-API-Key`
3. **WebSocket**: API key passada via query parameter `?key=`

### Considerações

- API key transmitida em texto (usar HTTPS em produção)
- Sem rate limiting (implementar se exposto publicamente)
- Comandos shell executados com permissões do usuário que roda o servidor
- Arquivos acessíveis são limitados às permissões do processo

## Variáveis de Ambiente

### Skill Server

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SKILL_PORT` | 3000 | Porta HTTP/WebSocket |
| `SKILL_HOST` | 0.0.0.0 | Interface de rede |
| `SKILL_API_KEY` | (auto) | Chave de autenticação |
| `SKILL_LOG_LEVEL` | info | Nível de log |
| `SKILL_COMMAND_TIMEOUT` | 30000 | Timeout de comandos (ms) |
| `SKILL_WS_HEARTBEAT` | 30000 | Intervalo heartbeat (ms) |

## Dependências

### Skill Server

```json
{
  "express": "^4.18.2",     // Framework HTTP
  "ws": "^8.14.2",          // WebSocket server
  "cors": "^2.8.5",         // CORS middleware
  "dotenv": "^16.3.1",      // Carregar .env
  "winston": "^3.11.0",     // Logging
  "localtunnel": "^2.0.2"   // Tunnel público
}
```

### Mobile App

```json
{
  "@ionic/angular": "^7.0.0",
  "@angular/core": "^17.0.0",
  "@capacitor/core": "^5.0.0",
  "@capacitor/ios": "^5.0.0",
  "@capacitor/android": "^5.0.0",
  "@ionic/storage-angular": "^4.0.0",
  "rxjs": "^7.8.0"
}
```

## Scripts de Automação

### Hook SessionStart (scripts/start-server.js)

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code inicia sessão                                       │
│  → Hook SessionStart dispara                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  start-server.js recebe JSON via stdin                          │
│  { hook_event_name: "SessionStart", ... }                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Verificar se já está rodando (PID file)                        │
│  Se sim → exit                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Spawn servidor em background (detached)                        │
│  Salvar PID em /tmp/claude-bridge.pid                           │
│  Log em /tmp/claude-bridge.log                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Aguardar 4s para tunnel conectar                               │
│  Ler URL e API Key do log                                        │
│  Exibir no terminal                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Hook SessionEnd (scripts/stop-server.js)

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code encerra sessão                                      │
│  → Hook SessionEnd dispara                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Ler PID de /tmp/claude-bridge.pid                              │
│  Enviar SIGTERM para o processo                                  │
│  Remover PID file e log file                                     │
└─────────────────────────────────────────────────────────────────┘
```
