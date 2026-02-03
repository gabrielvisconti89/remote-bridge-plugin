# SSH/PTY Migration Plan - Remote Bridge

## Objetivo
Mudar a arquitetura do plugin para usar PTY (Pseudo Terminal) que permite controle real do Claude CLI, proporcionando experiência idêntica ao terminal do Mac.

## Arquitetura Atual vs Nova

### Atual (Command Queue)
```
Mobile App ←→ HTTP/WS ←→ Plugin Server ←→ Command Queue ←→ Claude CLI (indireto)
                                              ↓
                                    Só confirmações de API
```

### Nova (PTY Direct)
```
Mobile App ←→ WebSocket ←→ Plugin Server ←→ PTY (node-pty) ←→ Claude CLI (direto)
                                              ↓
                                    Terminal I/O real em tempo real
```

## Fases de Implementação

### Fase 1: Backend - PTY Manager
- [ ] Adicionar `node-pty` ao plugin
- [ ] Criar `PtyManager` class para gerenciar sessões Claude
- [ ] WebSocket endpoint `/terminal` para streaming bidirecional
- [ ] Suporte a resize do terminal
- [ ] Buffer de output para reconexão

### Fase 2: Backend - Session Management
- [ ] Persistência de sessão (reconectar a sessão existente)
- [ ] Detecção de modo (plan/normal) via output parsing
- [ ] Envio de keystrokes especiais (Shift+Tab para modo)
- [ ] Manter APIs existentes para compatibilidade

### Fase 3: Frontend - Terminal Display
- [ ] Adicionar `xterm.js` + `xterm-addon-fit` ao app
- [ ] Criar `TerminalService` para comunicação WebSocket PTY
- [ ] Substituir chat bubbles por terminal real na aba Chat
- [ ] Handling de input via teclado virtual

### Fase 4: Frontend - Enhanced UX
- [ ] Botão de modo (tap para alternar plan/normal/autoAccept)
- [ ] Storage local do histórico do terminal
- [ ] Scroll infinito com carregamento incremental
- [ ] Reconexão automática com restauração de sessão

### Fase 5: Testing com Playwright
- [ ] Testar conexão e renderização do terminal
- [ ] Testar envio de comandos
- [ ] Testar troca de modos
- [ ] Testar histórico e persistência

## Arquivos a Criar/Modificar

### Plugin (remote-bridge-plugin/)
```
skill/
├── utils/
│   └── ptyManager.js          # NOVO - Gerenciador de PTY
├── handlers/
│   └── terminal.js            # NOVO - Handler WebSocket terminal
├── server.js                  # MODIFICAR - Adicionar endpoint terminal
└── package.json               # MODIFICAR - Adicionar node-pty
```

### App (remote-bridge/app/)
```
src/app/
├── core/services/
│   └── terminal.service.ts    # NOVO - Comunicação PTY
├── features/chat/
│   ├── pages/
│   │   └── chat-main/
│   │       └── chat-main.page.ts    # MODIFICAR - Usar terminal
│   └── components/
│       └── terminal-view/           # NOVO - Componente xterm
│           ├── terminal-view.component.ts
│           ├── terminal-view.component.html
│           └── terminal-view.component.scss
└── package.json               # MODIFICAR - Adicionar xterm.js
```

## Detalhes Técnicos

### PTY Manager (Node.js)
```javascript
// Spawn Claude CLI in PTY
const pty = require('node-pty');
const shell = pty.spawn('claude', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.env.HOME,
  env: process.env
});

// Bidirecional I/O
shell.onData(data => ws.send({ type: 'output', data }));
ws.on('message', msg => {
  if (msg.type === 'input') shell.write(msg.data);
  if (msg.type === 'resize') shell.resize(msg.cols, msg.rows);
});
```

### Terminal Service (Angular)
```typescript
// Conectar ao PTY via WebSocket
connectTerminal(connection: Connection): Observable<TerminalEvent> {
  const ws = new WebSocket(`wss://${connection.host}/terminal`);
  return new Observable(observer => {
    ws.onmessage = (e) => observer.next(JSON.parse(e.data));
    ws.onerror = (e) => observer.error(e);
  });
}

// Enviar input
sendInput(data: string) { this.ws.send({ type: 'input', data }); }

// Resize
resize(cols: number, rows: number) {
  this.ws.send({ type: 'resize', cols, rows });
}
```

### XTerm Component (Angular)
```typescript
// Inicializar terminal
this.terminal = new Terminal({ cursorBlink: true });
this.fitAddon = new FitAddon();
this.terminal.loadAddon(this.fitAddon);
this.terminal.open(this.terminalContainer.nativeElement);
this.fitAddon.fit();

// Receber output
terminalService.output$.subscribe(data => {
  this.terminal.write(data);
  this.saveToHistory(data); // Persistir localmente
});

// Enviar input
this.terminal.onData(data => terminalService.sendInput(data));
```

## Features Preservadas
1. ✅ Conexão com API key
2. ✅ LocalTunnel para acesso externo
3. ✅ Modos (plan/autoAccept) - agora via tap
4. ✅ Histórico - agora local no app
5. ✅ Screenshots
6. ✅ File operations
7. ✅ System info
8. ✅ Statusline integration
9. ✅ Hooks (SessionStart/End/PostToolUse)

## Métricas de Sucesso
- [ ] Playwright consegue conectar e ver terminal
- [ ] Playwright consegue enviar comando e ver resposta
- [ ] Playwright consegue trocar de modo
- [ ] Output idêntico ao terminal real do Mac
- [ ] Latência < 100ms para input
- [ ] Reconexão restaura sessão existente
