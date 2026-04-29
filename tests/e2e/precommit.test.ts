import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

describe('opencode-scaffold init pre-commit [E2E]', () => {
  const TEST_DIR = path.join(process.cwd(), 'test_repo_precommit_e2e');
  const BIN_PATH = path.join(process.cwd(), 'dist', 'index.js');

  beforeAll(async () => {
    // Ensure clean state before test
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up after test
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should generate .pre-commit-config.yaml correctly with --yes flag', async () => {
    const { stdout, exitCode } = await execa('node', [BIN_PATH, 'init', '--yes'], {
      cwd: TEST_DIR,
    });

    // Process should exit successfully
    expect(exitCode).toBe(0);
    expect(stdout).toContain('successfully initialized');

    // Path to the generated pre-commit config
    const preCommitConfigPath = path.join(TEST_DIR, '.pre-commit-config.yaml');
    
    // Verify file exists
    let fileExists = true;
    try {
      await fs.stat(preCommitConfigPath);
    } catch {
      fileExists = false;
    }
    expect(fileExists).toBe(true);

    // Verify file content matches expected tools
    const configContent = await fs.readFile(preCommitConfigPath, 'utf-8');
    
    // Python linters
    expect(configContent).toContain('repo: https://github.com/astral-sh/ruff-pre-commit');
    expect(configContent).toContain('id: ruff');
    expect(configContent).toContain('id: ruff-format');
    expect(configContent).toContain('repo: https://github.com/pre-commit/mirrors-mypy');
    
    // JS/TS linters
    expect(configContent).toContain('repo: https://github.com/pre-commit/mirrors-eslint');
    expect(configContent).toContain('id: eslint');
    
    // AI Verification Tests (Local hook)
    expect(configContent).toContain('repo: local');
    expect(configContent).toContain('id: tests');
    expect(configContent).toContain('AI Verification Tests (pytest or npm test)');
    expect(configContent).toContain('entry: bash -c "if [ -f package.json ]; then npm test; else pytest tests/; fi"');
  });
});