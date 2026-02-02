const fs = require('fs');
const path = require('path');

// Mock the os module before requiring
jest.mock('os', () => ({
  homedir: () => global.TEST_STATE_DIR,
  platform: () => 'darwin',
}));

let commandQueue;

beforeEach(() => {
  // Clear module cache
  jest.resetModules();
  // Require fresh commandQueue module
  commandQueue = require('../../utils/commandQueue');
  // Clean up commands
  commandQueue.clearAll();
});

describe('commandQueue utility', () => {
  describe('addCommand', () => {
    it('adds a command to the queue', () => {
      const result = commandQueue.addCommand('npm test', 'iPhone 15');

      expect(result).toHaveProperty('id');
      expect(result.id).toMatch(/^cmd_[a-f0-9]{12}$/);
      expect(result.command).toBe('npm test');
      expect(result.from).toBe('iPhone 15');
      expect(result.status).toBe('pending');
      expect(result.receivedAt).toBeDefined();
    });

    it('uses default device name when not provided', () => {
      const result = commandQueue.addCommand('ls -la');

      expect(result.from).toBe('Unknown Device');
    });

    it('generates unique IDs for each command', () => {
      const cmd1 = commandQueue.addCommand('command1');
      const cmd2 = commandQueue.addCommand('command2');
      const cmd3 = commandQueue.addCommand('command3');

      expect(cmd1.id).not.toBe(cmd2.id);
      expect(cmd2.id).not.toBe(cmd3.id);
      expect(cmd1.id).not.toBe(cmd3.id);
    });

    it('persists commands to file', () => {
      commandQueue.addCommand('test command');

      const commandsFile = path.join(
        global.TEST_STATE_DIR,
        '.claude',
        'remote-bridge',
        'commands.json'
      );
      expect(fs.existsSync(commandsFile)).toBe(true);

      const data = JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
      expect(data.queue).toHaveLength(1);
      expect(data.queue[0].command).toBe('test command');
    });
  });

  describe('getCommands', () => {
    it('returns empty array when no commands exist', () => {
      const result = commandQueue.getCommands();

      expect(result).toEqual([]);
    });

    it('returns only pending commands', () => {
      const cmd1 = commandQueue.addCommand('command1');
      const cmd2 = commandQueue.addCommand('command2');
      const cmd3 = commandQueue.addCommand('command3');

      commandQueue.updateCommandStatus(cmd2.id, 'executed');

      const result = commandQueue.getCommands();

      expect(result).toHaveLength(2);
      expect(result.find((c) => c.id === cmd1.id)).toBeDefined();
      expect(result.find((c) => c.id === cmd2.id)).toBeUndefined();
      expect(result.find((c) => c.id === cmd3.id)).toBeDefined();
    });
  });

  describe('getAllCommands', () => {
    it('returns all commands regardless of status', () => {
      const cmd1 = commandQueue.addCommand('command1');
      const cmd2 = commandQueue.addCommand('command2');
      const cmd3 = commandQueue.addCommand('command3');

      commandQueue.updateCommandStatus(cmd1.id, 'executed');
      commandQueue.updateCommandStatus(cmd3.id, 'dismissed');

      const result = commandQueue.getAllCommands();

      expect(result).toHaveLength(3);
    });
  });

  describe('getCommand', () => {
    it('returns command by ID', () => {
      const added = commandQueue.addCommand('test command', 'Test Device');

      const result = commandQueue.getCommand(added.id);

      expect(result).toEqual(added);
    });

    it('returns null for non-existent ID', () => {
      const result = commandQueue.getCommand('cmd_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateCommandStatus', () => {
    it('updates command status to executed', () => {
      const added = commandQueue.addCommand('test');

      const result = commandQueue.updateCommandStatus(added.id, 'executed');

      expect(result.status).toBe('executed');
      expect(result.updatedAt).toBeDefined();
    });

    it('updates command status to dismissed', () => {
      const added = commandQueue.addCommand('test');

      const result = commandQueue.updateCommandStatus(added.id, 'dismissed');

      expect(result.status).toBe('dismissed');
    });

    it('returns null for non-existent ID', () => {
      const result = commandQueue.updateCommandStatus('cmd_nonexistent', 'executed');

      expect(result).toBeNull();
    });

    it('persists status update to file', () => {
      const added = commandQueue.addCommand('test');
      commandQueue.updateCommandStatus(added.id, 'executed');

      // Re-read from file
      jest.resetModules();
      const freshQueue = require('../../utils/commandQueue');
      const command = freshQueue.getCommand(added.id);

      expect(command.status).toBe('executed');
    });
  });

  describe('clearCommand', () => {
    it('removes specific command from queue', () => {
      const cmd1 = commandQueue.addCommand('command1');
      const cmd2 = commandQueue.addCommand('command2');

      const result = commandQueue.clearCommand(cmd1.id);

      expect(result).toBe(true);
      expect(commandQueue.getCommand(cmd1.id)).toBeNull();
      expect(commandQueue.getCommand(cmd2.id)).not.toBeNull();
    });

    it('returns false for non-existent ID', () => {
      const result = commandQueue.clearCommand('cmd_nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('removes all commands from queue', () => {
      commandQueue.addCommand('command1');
      commandQueue.addCommand('command2');
      commandQueue.addCommand('command3');

      commandQueue.clearAll();

      expect(commandQueue.getAllCommands()).toHaveLength(0);
    });
  });

  describe('clearCompleted', () => {
    it('removes only executed and dismissed commands', () => {
      const cmd1 = commandQueue.addCommand('command1');
      const cmd2 = commandQueue.addCommand('command2');
      const cmd3 = commandQueue.addCommand('command3');
      const cmd4 = commandQueue.addCommand('command4');

      commandQueue.updateCommandStatus(cmd1.id, 'executed');
      commandQueue.updateCommandStatus(cmd3.id, 'dismissed');

      commandQueue.clearCompleted();

      const remaining = commandQueue.getAllCommands();
      expect(remaining).toHaveLength(2);
      expect(remaining.find((c) => c.id === cmd2.id)).toBeDefined();
      expect(remaining.find((c) => c.id === cmd4.id)).toBeDefined();
    });

    it('keeps all pending commands', () => {
      commandQueue.addCommand('command1');
      commandQueue.addCommand('command2');

      commandQueue.clearCompleted();

      expect(commandQueue.getCommands()).toHaveLength(2);
    });
  });

  describe('getPendingCount', () => {
    it('returns count of pending commands', () => {
      commandQueue.addCommand('command1');
      commandQueue.addCommand('command2');
      commandQueue.addCommand('command3');

      expect(commandQueue.getPendingCount()).toBe(3);
    });

    it('excludes non-pending commands from count', () => {
      const cmd1 = commandQueue.addCommand('command1');
      commandQueue.addCommand('command2');
      const cmd3 = commandQueue.addCommand('command3');

      commandQueue.updateCommandStatus(cmd1.id, 'executed');
      commandQueue.updateCommandStatus(cmd3.id, 'dismissed');

      expect(commandQueue.getPendingCount()).toBe(1);
    });

    it('returns 0 when no pending commands', () => {
      expect(commandQueue.getPendingCount()).toBe(0);
    });
  });
});
