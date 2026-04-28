import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

describe('opencode-scaffold init [E2E]', () => {
  const TEST_DIR = path.join(process.cwd(), 'test_repo_e2e');
  const BIN_PATH = path.join(process.cwd(), 'dist', 'index.js');

  beforeAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up after test
    // await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should initialize opencode scaffold structure correctly', async () => {
    const { stdout, exitCode } = await execa('node', [BIN_PATH, 'init', '--yes'], {
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('successfully initialized');

    // 1. Check Global Config
    const scaffoldConfigPath = path.join(TEST_DIR, '.opencode-scaffold.json');
    const scaffoldConfigContent = await fs.readFile(scaffoldConfigPath, 'utf-8');
    const scaffoldConfig = JSON.parse(scaffoldConfigContent);
    expect(scaffoldConfig.version).toBe('2.0');
    expect(scaffoldConfig.features.enableWeb).toBe(true);

    // 2. Check OpenCode Config
    const ocConfigPath = path.join(TEST_DIR, '.opencode', 'config.json');
    const ocConfigContent = await fs.readFile(ocConfigPath, 'utf-8');
    expect(ocConfigContent).toContain('websearch,webfetch');

    // 3. Check Memory Bank
    const memoryBankDir = path.join(TEST_DIR, '.opencode', 'memory-bank');
    const mbFiles = await fs.readdir(memoryBankDir);
    expect(mbFiles).toEqual(
      expect.arrayContaining([
        'activeContext.md',
        'productContext.md',
        'progress.md',
        'projectbrief.md',
        'systemContext.md'
      ])
    );

    // 4. Check Native Agents
    const agentsDir = path.join(TEST_DIR, '.opencode', 'agents');
    const agentFiles = await fs.readdir(agentsDir);
    expect(agentFiles).toContain('architect.md');
    expect(agentFiles).toContain('qa_engineer.md');
    
    const architectMd = await fs.readFile(path.join(agentsDir, 'architect.md'), 'utf-8');
    expect(architectMd).toContain('mode: primary');
    expect(architectMd).toContain('model: google/gemini-3.1-pro-preview');

    // 5. Check Agent Prompts
    const promptsDir = path.join(agentsDir, 'prompts');
    const promptFiles = await fs.readdir(promptsDir);
    expect(promptFiles).toContain('qa_engineer.txt');
    
    const qaPrompt = await fs.readFile(path.join(promptsDir, 'qa_engineer.txt'), 'utf-8');
    expect(qaPrompt).toContain('QA automation engineer');
  });
});
