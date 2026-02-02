# Remote Bridge Modes

Remote Bridge supports toggling Claude Code modes from the mobile app.

## Available Modes

| Mode | Description |
|------|-------------|
| Plan Mode | Claude creates implementation plans before coding |
| Auto-accept | Automatically accept tool executions |

## How Mode Toggle Works

### Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Mobile  │────▶│  Server  │────▶│ Keystroke│────▶│  Claude  │
│   App    │     │   API    │     │ Emulation│     │   Code   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                    │
     │◀───────────────────────────────────────────────────│
                    State Update via WebSocket
```

1. User taps mode toggle in mobile app
2. App sends POST to `/modes/toggle`
3. Server sends Shift+Tab keystroke to terminal
4. Claude Code toggles the mode
5. Server updates state and notifies app

### State Storage

Mode state is stored in `~/.claude/remote-bridge/state.json`:

```json
{
  "modes": {
    "plan": false,
    "autoAccept": false
  }
}
```

**Note:** The state file tracks what the user requested, but the actual mode state is controlled by Claude Code. If Claude Code's mode changes independently (e.g., user presses Shift+Tab directly), the state file may become out of sync.

## API Reference

### GET /modes

Get current mode states.

**Request:**
```bash
curl http://localhost:3000/modes \
  -H "X-API-Key: {api-key}"
```

**Response:**
```json
{
  "success": true,
  "modes": {
    "plan": false,
    "autoAccept": false
  }
}
```

### POST /modes/toggle

Toggle a mode on/off.

**Request:**
```bash
curl -X POST http://localhost:3000/modes/toggle \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{"mode": "plan"}'
```

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | Yes | Mode to toggle: `plan` or `autoAccept` |

**Response:**
```json
{
  "success": true,
  "mode": "plan",
  "active": true,
  "modes": {
    "plan": true,
    "autoAccept": false
  }
}
```

## Implementation Details

### Keystroke Emulation

The mode toggle uses Shift+Tab keystroke emulation:

#### macOS (AppleScript)

```javascript
execSync(`osascript -e 'tell application "System Events" to keystroke tab using shift down'`);
```

#### Linux (xdotool)

```javascript
execSync('xdotool key shift+Tab');
```

#### Windows

Windows support is not yet implemented for mode toggle.

### Code Location

Mode handling is in `skill/handlers/modes.js`:

```javascript
const router = Router();

router.get('/', (req, res) => {
  const currentState = state.readState();
  res.json({
    success: true,
    modes: currentState.modes || { plan: false, autoAccept: false }
  });
});

router.post('/toggle', async (req, res) => {
  const { mode } = req.body;

  // Validate mode
  if (!['plan', 'autoAccept'].includes(mode)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid mode. Must be "plan" or "autoAccept"'
    });
  }

  // Toggle state
  const currentState = state.readState();
  const modes = currentState.modes || { plan: false, autoAccept: false };
  modes[mode] = !modes[mode];
  state.updateState({ modes });

  // Send keystroke
  if (os.platform() === 'darwin') {
    execSync(`osascript -e 'tell application "System Events" to keystroke tab using shift down'`);
  } else if (os.platform() === 'linux') {
    execSync('xdotool key shift+Tab');
  }

  res.json({
    success: true,
    mode,
    active: modes[mode],
    modes
  });
});
```

## Mobile App Integration

### Mode Display

The mobile app shows current mode state in the chat header or settings:

```
┌─────────────────────────────┐
│  Plan Mode: OFF    [Toggle] │
│  Auto-accept: OFF  [Toggle] │
└─────────────────────────────┘
```

### Toggle Implementation (Angular)

```typescript
// modes.service.ts
@Injectable({ providedIn: 'root' })
export class ModesService {
  private modes$ = new BehaviorSubject<Modes>({ plan: false, autoAccept: false });

  getModes(): Observable<Modes> {
    return this.apiService.get<{ modes: Modes }>('/modes').pipe(
      map(response => response.modes),
      tap(modes => this.modes$.next(modes))
    );
  }

  toggleMode(mode: 'plan' | 'autoAccept'): Observable<Modes> {
    return this.apiService.post<{ modes: Modes }>('/modes/toggle', { mode }).pipe(
      map(response => response.modes),
      tap(modes => this.modes$.next(modes))
    );
  }
}
```

## Limitations

### State Synchronization

The state file may not always reflect the actual Claude Code mode:

- User toggles mode directly in Claude Code (Shift+Tab)
- Claude Code changes mode based on context
- Session restart resets modes

**Recommendation:** Treat the state file as a "requested state" rather than "actual state".

### Platform Support

| Platform | Support |
|----------|---------|
| macOS | Full (AppleScript) |
| Linux | Full (xdotool) |
| Windows | Not implemented |

### Terminal Focus

The keystroke is sent to System Events, so it requires:

- Claude Code terminal to be focused (macOS)
- Active X11 session (Linux)

If the terminal is not focused, the keystroke may go to the wrong application.

## Best Practices

1. **Verify Mode State** - After toggling, check Claude Code's actual mode
2. **Handle Failures** - Network issues or unfocused terminal can cause toggle to fail
3. **Use Sparingly** - Mode toggles interrupt Claude Code's flow
4. **Document State** - Tell Claude Code which mode you want before starting work

## See Also

- [API Reference](API.md) - Full API documentation
- [Architecture](ARCHITECTURE.md) - System design
- [Command Queue](COMMAND-QUEUE.md) - Alternative for sending commands
