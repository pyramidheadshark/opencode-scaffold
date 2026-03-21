'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { run, listSessions, readSession } = require('../../lib/commands/session-logs');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-slogs-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeSessionsDir() {
  const dir = path.join(tmpDir, '.claude', 'logs', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSession(dir, filename, events) {
  const lines = events.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(path.join(dir, filename), lines + '\n', 'utf8');
}

describe('listSessions', () => {
  test('returns empty array when directory does not exist', () => {
    expect(listSessions(tmpDir)).toEqual([]);
  });

  test('returns only session-*.jsonl files sorted newest first', () => {
    const dir = makeSessionsDir();
    fs.writeFileSync(path.join(dir, 'session-2026-01-01-abc12345.jsonl'), '', 'utf8');
    fs.writeFileSync(path.join(dir, 'session-2026-01-02-def67890.jsonl'), '', 'utf8');
    fs.writeFileSync(path.join(dir, 'not-a-session.jsonl'), '', 'utf8');
    fs.writeFileSync(path.join(dir, 'session-noext'), '', 'utf8');

    const result = listSessions(tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('session-2026-01-02-def67890.jsonl');
    expect(result[1]).toBe('session-2026-01-01-abc12345.jsonl');
  });

  test('returns files in reverse alphabetical order', () => {
    const dir = makeSessionsDir();
    for (const name of ['session-2026-01-03-aaa.jsonl', 'session-2026-01-01-ccc.jsonl', 'session-2026-01-02-bbb.jsonl']) {
      fs.writeFileSync(path.join(dir, name), '', 'utf8');
    }
    const result = listSessions(tmpDir);
    expect(result[0]).toBe('session-2026-01-03-aaa.jsonl');
    expect(result[1]).toBe('session-2026-01-02-bbb.jsonl');
    expect(result[2]).toBe('session-2026-01-01-ccc.jsonl');
  });
});

describe('readSession', () => {
  test('returns null if file does not exist', () => {
    expect(readSession(tmpDir, 'session-nonexistent.jsonl')).toBeNull();
  });

  test('parses valid JSONL events', () => {
    const dir = makeSessionsDir();
    const events = [
      { type: 'session_start', timestamp: '2026-01-01T10:00:00Z', repo: 'myrepo', platform: 'linux' },
      { type: 'file_change', timestamp: '2026-01-01T10:01:00Z', tool: 'Write', path: 'src/foo.js' },
    ];
    writeSession(dir, 'session-2026-01-01-test1234.jsonl', events);

    const result = readSession(tmpDir, 'session-2026-01-01-test1234.jsonl');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('session_start');
    expect(result[1].type).toBe('file_change');
  });

  test('skips invalid JSON lines gracefully', () => {
    const dir = makeSessionsDir();
    const content = '{"type":"session_start","timestamp":"2026-01-01T10:00:00Z"}\nnot-valid-json\n{"type":"session_end","timestamp":"2026-01-01T11:00:00Z","weight":5}\n';
    fs.writeFileSync(path.join(dir, 'session-2026-01-01-abc.jsonl'), content, 'utf8');

    const result = readSession(tmpDir, 'session-2026-01-01-abc.jsonl');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('session_start');
    expect(result[1].type).toBe('session_end');
  });

  test('returns empty array for empty file', () => {
    const dir = makeSessionsDir();
    fs.writeFileSync(path.join(dir, 'session-2026-01-01-empty.jsonl'), '', 'utf8');
    const result = readSession(tmpDir, 'session-2026-01-01-empty.jsonl');
    expect(result).toEqual([]);
  });
});

describe('run — --list', () => {
  test('prints "No session logs found" when directory is absent', () => {
    const output = [];
    run(tmpDir, { list: true }, s => output.push(s));
    expect(output.join('')).toContain('No session logs found');
  });

  test('prints "No session logs found" when no matching files', () => {
    const dir = makeSessionsDir();
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), '', 'utf8');
    const output = [];
    run(tmpDir, { list: true }, s => output.push(s));
    expect(output.join('')).toContain('No session logs found');
  });

  test('lists sessions with count and filenames', () => {
    const dir = makeSessionsDir();
    writeSession(dir, 'session-2026-01-01-abc.jsonl', []);
    writeSession(dir, 'session-2026-01-02-def.jsonl', []);
    const output = [];
    run(tmpDir, { list: true }, s => output.push(s));
    const out = output.join('');
    expect(out).toContain('Session logs (2)');
    expect(out).toContain('session-2026-01-01-abc.jsonl');
    expect(out).toContain('session-2026-01-02-def.jsonl');
  });
});

describe('run — no opts (defaults to list)', () => {
  test('defaults to listing when no session/tail specified', () => {
    const dir = makeSessionsDir();
    writeSession(dir, 'session-2026-01-01-abc.jsonl', []);
    const output = [];
    run(tmpDir, {}, s => output.push(s));
    expect(output.join('')).toContain('Session logs');
  });
});

describe('run — --tail (most recent session)', () => {
  test('shows most recent session with tail events', () => {
    const dir = makeSessionsDir();
    const events = [
      { type: 'session_start', timestamp: '2026-01-01T10:00:00Z', repo: 'r', platform: 'linux' },
      { type: 'file_change', timestamp: '2026-01-01T10:01:00Z', tool: 'Write', path: 'a.js' },
      { type: 'file_change', timestamp: '2026-01-01T10:02:00Z', tool: 'Edit', path: 'b.js' },
      { type: 'session_end', timestamp: '2026-01-01T11:00:00Z', weight: 3.3 },
    ];
    writeSession(dir, 'session-2026-01-01-abc.jsonl', events);
    const output = [];
    run(tmpDir, { tail: 2 }, s => output.push(s));
    const out = output.join('');
    expect(out).toContain('CHANGE');
    expect(out).toContain('END');
    expect(out).not.toContain('START');
  });

  test('returns "No session logs found" when no files', () => {
    makeSessionsDir();
    const output = [];
    run(tmpDir, { tail: 5 }, s => output.push(s));
    expect(output.join('')).toContain('No session logs found');
  });
});

describe('run — --session <id>', () => {
  test('shows events for matching session', () => {
    const dir = makeSessionsDir();
    const events = [
      { type: 'session_start', timestamp: '2026-01-01T10:00:00Z', repo: 'myrepo', platform: 'linux' },
    ];
    writeSession(dir, 'session-2026-01-01-abc12345.jsonl', events);
    const output = [];
    run(tmpDir, { session: 'abc12345' }, s => output.push(s));
    expect(output.join('')).toContain('START');
    expect(output.join('')).toContain('myrepo');
  });

  test('shows error when session not found', () => {
    makeSessionsDir();
    const output = [];
    run(tmpDir, { session: 'nonexistent' }, s => output.push(s));
    expect(output.join('')).toContain('No session matching: nonexistent');
  });
});

describe('formatEvent output', () => {
  test('session_start shows repo and platform', () => {
    const dir = makeSessionsDir();
    writeSession(dir, 'session-2026-01-01-fmt.jsonl', [
      { type: 'session_start', timestamp: '2026-01-01T10:00:00.000Z', repo: 'testproject', platform: 'linux' },
    ]);
    const output = [];
    run(tmpDir, { session: 'fmt' }, s => output.push(s));
    const out = output.join('');
    expect(out).toMatch(/START.*testproject.*linux/);
  });

  test('file_change shows tool and path', () => {
    const dir = makeSessionsDir();
    writeSession(dir, 'session-2026-01-01-fmt2.jsonl', [
      { type: 'file_change', timestamp: '2026-01-01T10:01:00.000Z', tool: 'Write', path: 'src/app.js' },
    ]);
    const output = [];
    run(tmpDir, { session: 'fmt2' }, s => output.push(s));
    const out = output.join('');
    expect(out).toMatch(/CHANGE.*Write.*src\/app\.js/);
  });

  test('session_end shows snapshot and weight', () => {
    const dir = makeSessionsDir();
    writeSession(dir, 'session-2026-01-01-fmt3.jsonl', [
      { type: 'session_end', timestamp: '2026-01-01T11:00:00.000Z', snapshot_tag: 'claude/s-abc12345', weight: 7.3 },
    ]);
    const output = [];
    run(tmpDir, { session: 'fmt3' }, s => output.push(s));
    const out = output.join('');
    expect(out).toMatch(/END.*claude\/s-abc12345.*7\.3/);
  });

  test('destructive_op shows level and command snippet', () => {
    const dir = makeSessionsDir();
    writeSession(dir, 'session-2026-01-01-fmt4.jsonl', [
      { type: 'destructive_op', timestamp: '2026-01-01T10:05:00.000Z', level: 'CRITICAL', command: 'git reset --hard HEAD~3' },
    ]);
    const output = [];
    run(tmpDir, { session: 'fmt4' }, s => output.push(s));
    const out = output.join('');
    expect(out).toContain('CRITICAL');
    expect(out).toContain('git reset --hard');
  });

  test('unknown event type shows type name', () => {
    const dir = makeSessionsDir();
    writeSession(dir, 'session-2026-01-01-fmt5.jsonl', [
      { type: 'custom_event', timestamp: '2026-01-01T10:03:00.000Z' },
    ]);
    const output = [];
    run(tmpDir, { session: 'fmt5' }, s => output.push(s));
    expect(output.join('')).toContain('custom_event');
  });
});
