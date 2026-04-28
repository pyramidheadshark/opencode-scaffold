#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
const metricsPath = path.join(cwd, ".claude/logs/skill-metrics.jsonl");

if (!fs.existsSync(metricsPath)) {
  console.log("No metrics data found. Run some prompts first.");
  console.log(`Expected: ${metricsPath}`);
  process.exit(0);
}

const lines = fs.readFileSync(metricsPath, "utf8").trim().split("\n").filter(Boolean);
const entries = lines.map((l) => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);

if (entries.length === 0) {
  console.log("Metrics file is empty.");
  process.exit(0);
}

const skillCounts = {};
let totalSkills = 0;
const sessions = new Set();

for (const entry of entries) {
  sessions.add(entry.session_id);
  for (const skill of (entry.skills || [])) {
    skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    totalSkills++;
  }
}

const sorted = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
const top5 = sorted.slice(0, 5);
const avgSkillsPerPrompt = entries.length > 0 ? (totalSkills / entries.length).toFixed(2) : 0;

console.log("=== Skill Efficiency Report ===\n");
console.log(`Total prompts logged : ${entries.length}`);
console.log(`Unique sessions      : ${sessions.size}`);
console.log(`Avg skills per prompt: ${avgSkillsPerPrompt}`);
console.log("\nTop-5 skills by load frequency:");
if (top5.length === 0) {
  console.log("  (no skills loaded yet)");
} else {
  top5.forEach(([skill, count], i) => {
    console.log(`  ${i + 1}. ${skill.padEnd(35)} ${count} loads`);
  });
}
