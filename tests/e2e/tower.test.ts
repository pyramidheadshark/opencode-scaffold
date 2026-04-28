import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

describe('opencode-scaffold tower [E2E]', () => {
  const STATE_DIR = path.join(process.cwd(), '.opencode-global-state');
  const BIN_PATH = path.join(process.cwd(), 'dist', 'index.js');

  beforeAll(async () => {
    await fs.mkdir(STATE_DIR, { recursive: true });
    // Create 3 fake agent states
    const states = [
      { repo: 'repo1', status: 'Coding', command: 'edit', tokens: 1000, cost: '$0.01', memoryBank: 'Updated' },
      { repo: 'repo2', status: 'Testing', command: 'pytest', tokens: 2000, cost: '$0.02', memoryBank: 'Outdated' },
      { repo: 'repo3', status: 'Idle', command: '-', tokens: 500, cost: '$0.00', memoryBank: 'Unknown' },
    ];

    for (const state of states) {
      await fs.writeFile(
        path.join(STATE_DIR, `${state.repo}.json`),
        JSON.stringify(state)
      );
    }
  });

  afterAll(async () => {
    // Clean up
    await fs.rm(STATE_DIR, { recursive: true, force: true });
  });

  it('should parse and display 3 agents from IPC state files', async () => {
    // Run the tower command. Since it's an infinite loop TUI, we kill it after a brief moment.
    // Or we just check its initial output if possible, but ink renders to stdout dynamically.
    // We can run it detached, grab output, and kill.
    const subprocess = execa('node', [BIN_PATH, 'tower'], {
      env: { FORCE_COLOR: '0', DEBUG_INK: '1' },
    });

    // Let it render for 2000ms
    await new Promise((resolve) => setTimeout(resolve, 2000));
    subprocess.kill('SIGTERM');

    const result = await subprocess.catch((err) => err);
    const output = result.stdout || '';

    // Check if output contains the fake data
    expect(output).toContain('repo1');
    expect(output).toContain('repo2');
    expect(output).toContain('repo3');
    expect(output).toContain('Coding');
    expect(output).toContain('pytest');
  });
});
