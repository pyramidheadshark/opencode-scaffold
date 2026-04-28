'use strict';

const fs = require('fs');
const path = require('path');

function runMetrics(cwd) {
  const metricsPath = path.join(cwd, '.claude', 'logs', 'skill-metrics.jsonl');

  if (!fs.existsSync(metricsPath)) {
    console.log('No metrics data found. Run some prompts first.');
    console.log(`Expected: ${metricsPath}`);
    return;
  }

  const raw = fs.readFileSync(metricsPath, 'utf8').trim();
  if (!raw) {
    console.log('Metrics file is empty.');
    return;
  }

  const entries = raw.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  if (entries.length === 0) {
    console.log('No valid metrics entries found.');
    return;
  }

  const skillCounts = {};
  let totalSkillLoads = 0;
  const sessions = new Set();

  for (const entry of entries) {
    if (entry.session_id) sessions.add(entry.session_id);
    for (const skill of (entry.skills || [])) {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      totalSkillLoads++;
    }
  }

  const sorted = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);
  const avgPerPrompt = entries.length > 0 ? (totalSkillLoads / entries.length).toFixed(2) : '0.00';

  const LINE = '-'.repeat(50);
  console.log(`\n${LINE}`);
  console.log('  claude-scaffold :: Skill Metrics');
  console.log(LINE);
  console.log(`  Total prompts logged : ${entries.length}`);
  console.log(`  Unique sessions      : ${sessions.size}`);
  console.log(`  Avg skills/prompt    : ${avgPerPrompt}`);
  console.log(`  Total skill loads    : ${totalSkillLoads}`);
  console.log();
  console.log('  Top-5 skills by load frequency:');
  if (top5.length === 0) {
    console.log('    (no skills loaded yet)');
  } else {
    top5.forEach(([skill, count], i) => {
      const bar = '#'.repeat(Math.min(count, 20));
      console.log(`  ${i + 1}. ${skill.padEnd(32)} ${String(count).padStart(4)} loads  ${bar}`);
    });
  }
  console.log(LINE);
  console.log();
}

module.exports = { runMetrics };
