const { Router } = require('express');
const { execSync } = require('child_process');
const os = require('os');
const state = require('../utils/state');
const logger = require('../utils/logger');

const router = Router();

/**
 * GET /modes - Get current mode states
 */
router.get('/', (req, res) => {
  const currentState = state.readState();
  res.json({
    success: true,
    modes: currentState.modes || { plan: false, autoAccept: false }
  });
});

/**
 * POST /modes/toggle - Toggle a mode on/off
 * Body: { mode: 'plan' | 'autoAccept' }
 */
router.post('/toggle', async (req, res) => {
  const { mode } = req.body;

  if (!['plan', 'autoAccept'].includes(mode)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid mode. Must be "plan" or "autoAccept"'
    });
  }

  const currentState = state.readState();
  const modes = currentState.modes || { plan: false, autoAccept: false };
  modes[mode] = !modes[mode];
  state.updateState({ modes });

  // Send Shift+Tab keystroke to toggle mode in Claude Code terminal
  if (os.platform() === 'darwin') {
    try {
      execSync(`osascript -e 'tell application "System Events" to keystroke tab using shift down'`);
      logger.info('Sent Shift+Tab to toggle mode', { mode, active: modes[mode] });
    } catch (err) {
      logger.error('Failed to send keystroke', { error: err.message });
    }
  } else if (os.platform() === 'linux') {
    try {
      execSync('xdotool key shift+Tab');
      logger.info('Sent Shift+Tab to toggle mode', { mode, active: modes[mode] });
    } catch (err) {
      logger.error('Failed to send keystroke (xdotool)', { error: err.message });
    }
  }

  res.json({
    success: true,
    mode,
    active: modes[mode],
    modes
  });
});

module.exports = router;
