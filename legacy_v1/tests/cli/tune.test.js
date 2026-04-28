'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { runTune } = require('../../lib/commands/tune');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-tune-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function readSettings() {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8'));
}

function writeSettings(obj) {
  const p = path.join(tmpDir, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
}

describe('tune — runTune', () => {
  test('creates .claude/settings.json if absent', () => {
    runTune(tmpDir, { effort: 'high' });
    expect(readSettings().env.CLAUDE_CODE_EFFORT_LEVEL).toBe('high');
  });

  test('overwrites existing CLAUDE_CODE_EFFORT_LEVEL', () => {
    writeSettings({ env: { CLAUDE_CODE_EFFORT_LEVEL: 'medium' } });
    runTune(tmpDir, { effort: 'max' });
    expect(readSettings().env.CLAUDE_CODE_EFFORT_LEVEL).toBe('max');
  });

  test('effort=off deletes CLAUDE_CODE_EFFORT_LEVEL key', () => {
    writeSettings({ env: { CLAUDE_CODE_EFFORT_LEVEL: 'max' } });
    runTune(tmpDir, { effort: 'off' });
    expect(readSettings().env.CLAUDE_CODE_EFFORT_LEVEL).toBeUndefined();
  });

  test('adaptiveThinking=off writes DISABLE_ADAPTIVE_THINKING=1', () => {
    runTune(tmpDir, { adaptiveThinking: 'off' });
    expect(readSettings().env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING).toBe('1');
  });

  test('adaptiveThinking=on deletes DISABLE_ADAPTIVE_THINKING key', () => {
    writeSettings({ env: { CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' } });
    runTune(tmpDir, { adaptiveThinking: 'on' });
    expect(readSettings().env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING).toBeUndefined();
  });

  test('thinkingSummaries=on sets showThinkingSummaries=true', () => {
    runTune(tmpDir, { thinkingSummaries: 'on' });
    expect(readSettings().showThinkingSummaries).toBe(true);
  });

  test('thinkingSummaries=off sets showThinkingSummaries=false', () => {
    writeSettings({ showThinkingSummaries: true });
    runTune(tmpDir, { thinkingSummaries: 'off' });
    expect(readSettings().showThinkingSummaries).toBe(false);
  });

  test('preserves unrelated hooks block', () => {
    const hooks = { UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: 'x' }] }] };
    writeSettings({ hooks, env: { FOO: 'bar' } });
    runTune(tmpDir, { effort: 'high' });
    const s = readSettings();
    expect(s.hooks).toEqual(hooks);
    expect(s.env.FOO).toBe('bar');
    expect(s.env.CLAUDE_CODE_EFFORT_LEVEL).toBe('high');
  });

  test('returns settingsPath and env summary', () => {
    const result = runTune(tmpDir, { effort: 'max', thinkingSummaries: 'on' });
    expect(result.settingsPath).toBe(path.join(tmpDir, '.claude', 'settings.json'));
    expect(result.env.CLAUDE_CODE_EFFORT_LEVEL).toBe('max');
    expect(result.showThinkingSummaries).toBe(true);
  });

  test('handles corrupt settings.json by starting fresh', () => {
    const p = path.join(tmpDir, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '{not valid json', 'utf8');
    runTune(tmpDir, { effort: 'high' });
    expect(readSettings().env.CLAUDE_CODE_EFFORT_LEVEL).toBe('high');
  });
});
