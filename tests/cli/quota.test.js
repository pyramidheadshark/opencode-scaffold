'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  DEFAULT_BUDGET,
  loadBudget,
  saveBudget,
  parseDailyReport,
  sumLastNDays,
  computeStatus,
  formatStatus,
} = require('../../lib/commands/quota');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-quota-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('quota — loadBudget', () => {
  test('returns defaults when no budget file', () => {
    const budget = loadBudget(path.join(tmpDir, 'nonexistent.json'));
    expect(budget.weekly_usd).toBe(DEFAULT_BUDGET.weekly_usd);
    expect(budget.warn_threshold_pct).toBe(DEFAULT_BUDGET.warn_threshold_pct);
  });

  test('loads custom budget from file', () => {
    const p = path.join(tmpDir, 'budget.json');
    fs.writeFileSync(p, JSON.stringify({ weekly_usd: 500, warn_threshold_pct: 70 }));
    const budget = loadBudget(p);
    expect(budget.weekly_usd).toBe(500);
    expect(budget.warn_threshold_pct).toBe(70);
    expect(budget.block_threshold_pct).toBe(DEFAULT_BUDGET.block_threshold_pct);
  });

  test('corrupt file falls back to defaults', () => {
    const p = path.join(tmpDir, 'budget.json');
    fs.writeFileSync(p, '{not-json');
    const budget = loadBudget(p);
    expect(budget.weekly_usd).toBe(DEFAULT_BUDGET.weekly_usd);
  });
});

describe('quota — saveBudget', () => {
  test('creates directory and writes file', () => {
    const p = path.join(tmpDir, 'nested', 'budget.json');
    saveBudget({ weekly_usd: 42 }, p);
    const loaded = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(loaded.weekly_usd).toBe(42);
  });
});

describe('quota — parseDailyReport', () => {
  test('parses valid ccusage JSON', () => {
    const stdout = JSON.stringify({ daily: [{ date: '2026-04-21', totalCost: 1.23 }] });
    const parsed = parseDailyReport(stdout);
    expect(parsed.daily).toHaveLength(1);
  });

  test('returns null for invalid JSON', () => {
    expect(parseDailyReport('not json')).toBeNull();
  });

  test('returns null for empty input', () => {
    expect(parseDailyReport('')).toBeNull();
    expect(parseDailyReport(null)).toBeNull();
  });
});

describe('quota — sumLastNDays', () => {
  function dateDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  test('sums totalCost over last N days', () => {
    const data = {
      daily: [
        { date: dateDaysAgo(0), totalCost: 1.0 },
        { date: dateDaysAgo(1), totalCost: 2.0 },
        { date: dateDaysAgo(5), totalCost: 3.0 },
        { date: dateDaysAgo(10), totalCost: 100.0 },
      ],
    };
    const total = sumLastNDays(data, 7);
    expect(total).toBeCloseTo(6.0, 1);
  });

  test('returns 0 for empty daily', () => {
    expect(sumLastNDays({ daily: [] }, 7)).toBe(0);
  });

  test('returns 0 when daily key missing', () => {
    expect(sumLastNDays({}, 7)).toBe(0);
    expect(sumLastNDays(null, 7)).toBe(0);
  });

  test('missing totalCost treated as 0', () => {
    const data = { daily: [{ date: dateDaysAgo(0) }, { date: dateDaysAgo(1), totalCost: 5 }] };
    expect(sumLastNDays(data, 7)).toBeCloseTo(5, 1);
  });
});

describe('quota — computeStatus', () => {
  const budget = { weekly_usd: 100, warn_threshold_pct: 80, block_threshold_pct: 95, currency: 'usd' };

  test('usage 50 → 50%, state ok', () => {
    const s = computeStatus(budget, { available: true, weekly_usd: 50 });
    expect(s.state).toBe('ok');
    expect(s.usage_pct).toBe(50);
  });

  test('usage 85 → 85%, state warn', () => {
    const s = computeStatus(budget, { available: true, weekly_usd: 85 });
    expect(s.state).toBe('warn');
    expect(s.usage_pct).toBe(85);
  });

  test('usage 97 → 97%, state block', () => {
    const s = computeStatus(budget, { available: true, weekly_usd: 97 });
    expect(s.state).toBe('block');
    expect(s.usage_pct).toBe(97);
  });

  test('boundary: exactly at warn threshold triggers warn', () => {
    const s = computeStatus(budget, { available: true, weekly_usd: 80 });
    expect(s.state).toBe('warn');
  });

  test('boundary: exactly at block threshold triggers block', () => {
    const s = computeStatus(budget, { available: true, weekly_usd: 95 });
    expect(s.state).toBe('block');
  });

  test('usage not available → state unknown', () => {
    const s = computeStatus(budget, { available: false, reason: 'test' });
    expect(s.state).toBe('unknown');
    expect(s.usage_pct).toBeNull();
  });

  test('budget weekly_usd=0 → 0%', () => {
    const zeroBudget = { ...budget, weekly_usd: 0 };
    const s = computeStatus(zeroBudget, { available: true, weekly_usd: 10 });
    expect(s.usage_pct).toBe(0);
  });
});

describe('quota — formatStatus', () => {
  const budget = { weekly_usd: 100, warn_threshold_pct: 80, block_threshold_pct: 95, currency: 'usd' };

  test('formats ok status with green icon', () => {
    const output = formatStatus(computeStatus(budget, { available: true, weekly_usd: 50, source: 'ccusage' }));
    expect(output).toContain('🟢');
    expect(output).toContain('50%');
  });

  test('formats warn status with yellow icon', () => {
    const output = formatStatus(computeStatus(budget, { available: true, weekly_usd: 85, source: 'ccusage' }));
    expect(output).toContain('🟡');
  });

  test('formats block status with red icon', () => {
    const output = formatStatus(computeStatus(budget, { available: true, weekly_usd: 98, source: 'ccusage' }));
    expect(output).toContain('🔴');
  });

  test('formats unavailable status', () => {
    const output = formatStatus({ state: 'unknown', usage: null, budget });
    expect(output).toContain('unknown');
  });

  test('formats unavailable with reason from usage', () => {
    const output = formatStatus({ state: 'unknown', usage: { available: false, reason: 'test-reason' }, budget });
    expect(output).toContain('test-reason');
  });
});
