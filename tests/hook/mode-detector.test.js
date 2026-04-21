'use strict';

const { detectMode, buildModeSwitchBlock } = require('../../.claude/hooks/mode-detector');

describe('mode-detector — detectMode', () => {
  test('detects economy mode (RU)', () => {
    expect(detectMode('Переходим в экономный режим').mode).toBe('economy');
    expect(detectMode('все на хайку').mode).toBe('economy');
  });

  test('detects economy mode (EN)', () => {
    expect(detectMode('switch to economy mode').mode).toBe('economy');
  });

  test('detects no-sonnet mode (RU)', () => {
    expect(detectMode('убери сонет').mode).toBe('no-sonnet');
    expect(detectMode('режим без сонета').mode).toBe('no-sonnet');
    expect(detectMode('переключи на опус').mode).toBe('no-sonnet');
  });

  test('detects no-sonnet mode (EN)', () => {
    expect(detectMode('switch to no-sonnet mode').mode).toBe('no-sonnet');
  });

  test('detects default mode (RU)', () => {
    expect(detectMode('верни сонет').mode).toBe('default');
    expect(detectMode('обычный режим').mode).toBe('default');
  });

  test('detects default mode (EN)', () => {
    expect(detectMode('switch to default mode').mode).toBe('default');
    expect(detectMode('back to sonnet mode').mode).toBe('default');
  });

  test('returns null for unrelated prompts', () => {
    expect(detectMode('fix the bug in auth.py')).toBeNull();
    expect(detectMode('what is the weather')).toBeNull();
  });

  test('returns null for empty input', () => {
    expect(detectMode('')).toBeNull();
    expect(detectMode(null)).toBeNull();
    expect(detectMode(undefined)).toBeNull();
  });

  test('detects transient flag for "task in <mode> mode"', () => {
    const d = detectMode('делаем задачу в экономном режиме');
    expect(d.mode).toBe('economy');
    expect(d.transient).toBe(true);
  });

  test('persistent switch has transient=false', () => {
    const d = detectMode('Переходим в экономный режим');
    expect(d.mode).toBe('economy');
    expect(d.transient).toBe(false);
  });
});

describe('mode-detector — buildModeSwitchBlock', () => {
  test('RU persistent switch mentions Bash command', () => {
    const b = buildModeSwitchBlock({ mode: 'economy', transient: false }, 'ru');
    expect(b).toContain('claude-scaffold mode economy');
    expect(b).toContain('перезапусти сессию');
  });

  test('EN persistent switch mentions restart', () => {
    const b = buildModeSwitchBlock({ mode: 'economy', transient: false }, 'en');
    expect(b).toContain('claude-scaffold mode economy');
    expect(b).toContain('Restart session');
  });

  test('RU transient uses /model slash command', () => {
    const b = buildModeSwitchBlock({ mode: 'economy', transient: true }, 'ru');
    expect(b).toContain('/model claude-haiku');
    expect(b).toContain('только в текущей сессии');
  });

  test('EN transient uses /model slash command', () => {
    const b = buildModeSwitchBlock({ mode: 'no-sonnet', transient: true }, 'en');
    expect(b).toContain('/model claude-opus-4-6');
    expect(b).toContain('session-local');
  });

  test('block title includes mode in uppercase', () => {
    const b = buildModeSwitchBlock({ mode: 'no-sonnet', transient: false }, 'en');
    expect(b).toContain('NO-SONNET');
  });
});
