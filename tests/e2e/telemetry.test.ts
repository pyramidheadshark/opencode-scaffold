import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

describe('opencode-scaffold telemetry [E2E]', () => {
  const TEST_DIR = path.join(process.cwd(), 'test_repo_telemetry');
  const BIN_PATH = path.join(process.cwd(), 'src', 'index.ts');
  let serverProcess: any;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    serverProcess = execa('npx', ['tsx', BIN_PATH, 'telemetry'], {
      cwd: TEST_DIR,
      env: { FORCE_COLOR: '0' }
    });

    serverProcess.stdout?.on('data', (d: any) => console.log(`[SERVER] ${d.toString()}`));
    serverProcess.stderr?.on('data', (d: any) => console.error(`[SERVER ERR] ${d.toString()}`));
    serverProcess.catch((e: any) => console.error(`[SERVER CRASH]`, e));

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess.kill('SIGKILL');
    }
    // Clean up
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch(e) {}
  });

  it('should receive OTLP traces and save to telemetry.db', async () => {
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "1234567890abcdef1234567890abcdef",
                  spanId: "1234567890abcdef",
                  name: "test-span",
                  startTimeUnixNano: 1610000000000000000,
                  endTimeUnixNano: 1610000001000000000,
                }
              ]
            }
          ]
        }
      ]
    };

    const response = await fetch('http://localhost:4318/v1/traces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(200);

    // Give it a moment to flush to sqlite
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify DB file was created and size > 0
    const stat = await fs.stat(path.join(TEST_DIR, '.opencode', 'telemetry.db'));
    expect(stat.size).toBeGreaterThan(0);
  });
});
