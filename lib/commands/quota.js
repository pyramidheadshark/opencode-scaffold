'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const DEFAULT_BUDGET_PATH = path.join(os.homedir(), '.claude', 'quota-budget.json');
const CACHE_PATH = path.join(os.homedir(), '.claude', 'quota-cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000;

const DEFAULT_BUDGET = Object.freeze({
  weekly_usd: 100,
  warn_threshold_pct: 80,
  block_threshold_pct: 95,
  currency: 'usd',
});

function loadBudget(budgetPath) {
  const p = budgetPath || DEFAULT_BUDGET_PATH;
  if (!fs.existsSync(p)) return { ...DEFAULT_BUDGET };
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ...DEFAULT_BUDGET, ...raw };
  } catch {
    return { ...DEFAULT_BUDGET };
  }
}

function saveBudget(budget, budgetPath) {
  const p = budgetPath || DEFAULT_BUDGET_PATH;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(budget, null, 2) + '\n', 'utf8');
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (Date.now() - raw.cached_at > CACHE_TTL_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

function saveCache(data) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ ...data, cached_at: Date.now() }), 'utf8');
  } catch { /* non-fatal */ }
}

function ccusageAvailable() {
  try {
    require.resolve('ccusage');
    return true;
  } catch {
    return false;
  }
}

function runCcusage(args, opts = {}) {
  const timeout = opts.timeout || 10000;
  const tryCommand = (cmd, cmdArgs) => {
    try {
      const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', timeout });
      if (r.status === 0 && r.stdout) return r.stdout;
    } catch { /* fallthrough */ }
    return null;
  };

  if (ccusageAvailable()) {
    try {
      const binPath = require.resolve('ccusage');
      const out = tryCommand(process.execPath, [binPath, ...args]);
      if (out) return out;
    } catch { /* fallthrough */ }
  }

  const npxOut = tryCommand('npx', ['-y', 'ccusage', ...args]);
  return npxOut;
}

function parseDailyReport(stdout) {
  if (!stdout) return null;
  try {
    const data = JSON.parse(stdout);
    return data;
  } catch {
    return null;
  }
}

function sumLastNDays(dailyData, n) {
  if (!dailyData || !dailyData.daily) return 0;
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - n);
  let total = 0;
  for (const entry of dailyData.daily) {
    const d = new Date(entry.date);
    if (d >= cutoff) {
      total += (entry.totalCost || 0);
    }
  }
  return total;
}

function getWeeklyUsage(opts = {}) {
  if (!opts.skipCache) {
    const cached = loadCache();
    if (cached) return cached;
  }

  if (!ccusageAvailable() && !opts.tryNpx) {
    return { available: false, reason: 'ccusage not installed and npx fallback disabled' };
  }

  const output = runCcusage(['--json']);
  if (!output) {
    return { available: false, reason: 'ccusage invocation failed' };
  }

  const parsed = parseDailyReport(output);
  if (!parsed) {
    return { available: false, reason: 'failed to parse ccusage output' };
  }

  const weeklyCost = sumLastNDays(parsed, 7);
  const result = {
    available: true,
    weekly_usd: Math.round(weeklyCost * 100) / 100,
    source: 'ccusage',
    days_counted: 7,
  };
  saveCache(result);
  return result;
}

function computeStatus(budget, usage) {
  if (!usage || !usage.available) {
    return { state: 'unknown', usage_pct: null, usage, budget };
  }
  const pct = budget.weekly_usd > 0
    ? Math.round((usage.weekly_usd / budget.weekly_usd) * 1000) / 10
    : 0;

  let state = 'ok';
  if (pct >= budget.block_threshold_pct) state = 'block';
  else if (pct >= budget.warn_threshold_pct) state = 'warn';

  return { state, usage_pct: pct, usage, budget };
}

function getStatus(opts = {}) {
  const budget = loadBudget(opts.budgetPath);
  const usage = getWeeklyUsage(opts);
  return computeStatus(budget, usage);
}

function formatStatus(status) {
  const lines = [];
  if (!status.usage || !status.usage.available) {
    lines.push('  Weekly quota: unknown');
    lines.push(`  Reason: ${status.usage ? status.usage.reason : 'no data'}`);
    lines.push('  Hint: install ccusage — `npm i -g ccusage` — or ensure `npx ccusage` works');
    return lines.join('\n');
  }
  const b = status.budget;
  const u = status.usage;
  const icon = status.state === 'block' ? '🔴' : (status.state === 'warn' ? '🟡' : '🟢');
  lines.push(`  ${icon} Weekly quota: ${u.weekly_usd} / ${b.weekly_usd} ${b.currency.toUpperCase()} (${status.usage_pct}%)`);
  lines.push(`  Thresholds: warn ≥${b.warn_threshold_pct}%, block ≥${b.block_threshold_pct}%`);
  lines.push(`  Source: ${u.source} (local JSONL analysis; approximate)`);
  lines.push(`  Budget file: ${DEFAULT_BUDGET_PATH}`);
  return lines.join('\n');
}

function run(args) {
  const [sub] = args;

  if (!sub || sub === 'status') {
    const status = getStatus();
    console.log();
    console.log(formatStatus(status));
    console.log();
    return;
  }

  if (sub === 'init-budget') {
    if (fs.existsSync(DEFAULT_BUDGET_PATH)) {
      console.log(`  Budget already exists: ${DEFAULT_BUDGET_PATH}`);
      return;
    }
    saveBudget(DEFAULT_BUDGET);
    console.log(`  Created: ${DEFAULT_BUDGET_PATH}`);
    console.log('  Edit it to match your subscription plan.');
    return;
  }

  if (sub === 'refresh') {
    const status = getStatus({ skipCache: true, tryNpx: true });
    console.log();
    console.log(formatStatus(status));
    console.log();
    return;
  }

  console.error(`Unknown quota subcommand: ${sub}`);
  console.error('Valid: status, init-budget, refresh');
  process.exit(1);
}

module.exports = {
  DEFAULT_BUDGET,
  DEFAULT_BUDGET_PATH,
  loadBudget,
  saveBudget,
  loadCache,
  saveCache,
  ccusageAvailable,
  runCcusage,
  parseDailyReport,
  sumLastNDays,
  getWeeklyUsage,
  computeStatus,
  getStatus,
  formatStatus,
  run,
};
