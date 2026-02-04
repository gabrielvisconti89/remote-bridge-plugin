# Evolução das Skills do Remote Bridge

Documento para rastrear o progresso na configuração das skills/comandos do plugin.

## Status Atual

| Item | Status |
|------|--------|
| Skills carregando | ✅ Funcionando |
| plugin.json válido | ✅ Corrigido |
| Hooks disparando | ⏳ Testando (tentativa 3) |

**Última atualização:** 2026-02-03

**Tentativa atual:** Removido campo `matcher` vazio do `hooks/hooks.json`

---

## Histórico de Alterações

### 2026-02-03 (Tentativa 3) - Remover campo `matcher` vazio

**Problema identificado:**
- Skills carregam, mas hooks podem não estar disparando
- Comparando com plugin `ralph-loop` (que funciona), notei que ele **não tem campo `matcher`**
- Nosso `hooks.json` tinha `"matcher": ""` que pode causar problema

**Solução aplicada:**
- Removido campo `matcher` de todos os hooks em `hooks/hooks.json`
- Copiado arquivo atualizado para o cache do plugin

**Formato anterior (com problema):**
```json
{
  "SessionStart": [
    {
      "matcher": "",  // ← PROBLEMA: campo vazio pode não funcionar
      "hooks": [...]
    }
  ]
}
```

**Formato novo (baseado no ralph-loop):**
```json
{
  "SessionStart": [
    {
      "hooks": [...]  // ← SEM matcher, como ralph-loop faz
    }
  ]
}
```

**Próximo passo:** Reiniciar sessão e testar

---

### 2026-02-03 (Tentativa 2) - Correção do plugin.json e hooks

**Problema identificado:**
- O `plugin.json` tinha campos inválidos:
  - `statusline` (não é um campo válido)
  - `hooks` inline (formato incorreto)
- Claude Code não carregava as skills corretamente

**Solução aplicada:**

1. **Limpeza do plugin.json** - Removidos campos inválidos, mantendo apenas:
   ```json
   {
     "name": "remote-bridge",
     "description": "...",
     "version": "1.2.3",
     "author": { "name": "Gabriel Visconti" },
     "homepage": "...",
     "repository": "...",
     "license": "MIT",
     "keywords": [...]
   }
   ```

2. **Criação de hooks/hooks.json** - Hooks movidos para arquivo separado:
   ```json
   {
     "hooks": {
       "SessionStart": [...],
       "SessionEnd": [...],
       "PostToolUse": [...]
     }
   }
   ```

3. **Cache atualizado** - Plugin recarregado

**Resultado:** Skills aparecem na lista, mas hooks ainda não disparam

---

## Estrutura de Arquivos Relevante

```
remote-bridge-plugin/
├── .claude-plugin/
│   └── plugin.json        # Metadados do plugin (SEM hooks/statusline)
├── hooks/
│   └── hooks.json         # Configuração de hooks (ARQUIVO SEPARADO)
└── skills/
    ├── start/SKILL.md
    ├── stop/SKILL.md
    ├── status/SKILL.md
    └── inbox/SKILL.md
```

---

## Comandos de Teste

```bash
# Verificar se o plugin está carregado
# Na sessão do Claude Code, digitar:
/remote-bridge:

# Testar hook manualmente
echo '{"hook_event_name":"SessionStart"}' | ./scripts/start-server.js

# Ver logs do servidor
cat ~/.claude/remote-bridge/server.log

# Debug do Claude Code (se necessário)
claude --verbose
```

---

## Referências

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)

---

## Próximos Passos

- [ ] Testar `/remote-bridge:start` em nova sessão
- [ ] Verificar se hooks disparam automaticamente
- [ ] Testar conexão com app mobile
- [ ] Documentar qualquer problema encontrado

---

## Notas para Novas Sessões

Ao abrir uma nova sessão do Claude Code:

1. As skills devem aparecer automaticamente ao digitar `/remote-bridge:`
2. O hook `SessionStart` deve iniciar o servidor automaticamente
3. Se algo não funcionar, verificar:
   - `~/.claude/remote-bridge/server.log` para logs
   - Formato do `hooks/hooks.json`
   - Permissões dos scripts em `scripts/`

Para continuar o debug, compartilhe:
- Mensagem de erro (se houver)
- Output do comando que falhou
- Conteúdo dos arquivos relevantes
