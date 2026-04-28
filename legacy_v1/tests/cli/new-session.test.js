'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { newSession } = require('../../lib/commands/new-session');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-ns-test-'));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('C1-01: newSession creates session-YYYY-MM-DD.md', () => {
  test('creates file with correct date-based name', () => {
    const filepath = newSession(undefined, tmpDir);
    const today = new Date().toISOString().split('T')[0];
    expect(path.basename(filepath)).toBe(`session-${today}.md`);
    expect(fs.existsSync(filepath)).toBe(true);
  });
});

describe('C1-02: newSession uses description if provided', () => {
  test('description appears in file content', () => {
    const filepath = newSession('implement model router CLI', tmpDir);
    const content = fs.readFileSync(filepath, 'utf8');
    expect(content).toContain('implement model router CLI');
  });

  test('uses TBD when no description provided', () => {
    const filepath = newSession(undefined, tmpDir);
    const content = fs.readFileSync(filepath, 'utf8');
    expect(content).toContain('TBD');
  });
});

describe('C1-03: newSession is idempotent — does not overwrite existing', () => {
  test('second call returns same path without overwriting', () => {
    const first = newSession('first description', tmpDir);
    const originalContent = fs.readFileSync(first, 'utf8');

    const second = newSession('second description', tmpDir);
    const afterContent = fs.readFileSync(second, 'utf8');

    expect(first).toBe(second);
    expect(afterContent).toBe(originalContent);
    expect(afterContent).not.toContain('second description');
  });

  test('logs "already exists" message on second call', () => {
    newSession('first', tmpDir);
    newSession('second', tmpDir);
    const calls = console.log.mock.calls.map(c => c[0]);
    expect(calls.some(msg => msg.includes('already exists'))).toBe(true);
  });
});

describe('C1-04: newSession creates dev/active/ if not exists', () => {
  test('dev/active/ is created when missing', () => {
    const activeDir = path.join(tmpDir, 'dev', 'active');
    expect(fs.existsSync(activeDir)).toBe(false);
    newSession(undefined, tmpDir);
    expect(fs.existsSync(activeDir)).toBe(true);
  });
});

describe('C1-05: content contains required sections', () => {
  test('content includes ## Goal and ## Acceptance Criteria', () => {
    const filepath = newSession(undefined, tmpDir);
    const content = fs.readFileSync(filepath, 'utf8');
    expect(content).toContain('## Goal');
    expect(content).toContain('## Acceptance Criteria');
  });

  test('content includes ## Done When section', () => {
    const filepath = newSession(undefined, tmpDir);
    const content = fs.readFileSync(filepath, 'utf8');
    expect(content).toContain('## Done When');
  });
});
