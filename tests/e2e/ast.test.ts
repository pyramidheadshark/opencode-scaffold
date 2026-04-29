import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

describe('opencode-scaffold ast [E2E]', () => {
  const TEST_DIR = path.join(process.cwd(), 'test_repo_ast');
  const BIN_PATH = path.join(process.cwd(), 'src', 'index.ts');

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Generate a fake 1000-line FastAPI router
    // We want 50 function signatures.
    const pyLines = [
      'from fastapi import APIRouter',
      '',
      'router = APIRouter()',
      ''
    ];
    
    for (let i = 0; i < 50; i++) {
      pyLines.push(`@router.get("/route_${i}")`);
      pyLines.push(`def get_route_${i}(id: int):`);
      // Add 16 lines of dummy body to make the file ~1000 lines (50 * 18 = 900 + imports)
      for (let j = 0; j < 16; j++) {
        pyLines.push(`    dummy_var_${j} = id * ${j}`);
      }
      pyLines.push(`    return {"status": "ok", "route": ${i}}`);
      pyLines.push('');
    }

    await fs.writeFile(path.join(TEST_DIR, 'main.py'), pyLines.join('\n'));
  });

  afterAll(async () => {
    // Clean up
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should parse 1000-line python file and output 50 markdown signatures', async () => {
    // Replace backslashes with forward slashes for Windows execa/npx compatibility
    const safeDir = TEST_DIR.replace(/\\/g, '/');
    const { stdout, stderr } = await execa('npx', ['tsx', BIN_PATH, 'ast', '--dir', safeDir], {
      cwd: process.cwd()
    });

    console.log(stdout);
    if (stderr) console.error(stderr);

    expect(stdout).toContain('Generating AST Index');

    const projectMapPath = path.join(TEST_DIR, 'project_map.md');
    const projectMapContent = await fs.readFile(projectMapPath, 'utf-8');

    // It should have exactly 50 function definitions
    const matches = projectMapContent.match(/# def get_route_\d+\(\.\.\.\)/g);
    
    // Check that we have the matches
    expect(matches).not.toBeNull();
    if (matches) {
      expect(matches.length).toBe(50);
    }
  });
});
