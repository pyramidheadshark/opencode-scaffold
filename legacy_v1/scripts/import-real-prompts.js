#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const program = new Command();

program
  .name('import-real-prompts')
  .description('Import real prompts from Claude Code JSONL transcripts for benchmark annotation')
  .option('--jsonl <pattern>', 'Path or glob pattern to JSONL transcript files (comma-separated paths)')
  .option('--metrics <path>', 'Path to skill-metrics.jsonl for skill recovery (optional)')
  .option('--out <path>', 'Output JSON file path', 'tests/benchmark/real-prompts.json')
  .option('--limit <n>', 'Max prompts to extract', '200')
  .helpOption('-h, --help', 'Show help');

program.parse(process.argv);
const opts = program.opts();

if (!opts.jsonl) {
  console.error('Error: --jsonl <path> is required');
  process.exit(1);
}

function readJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const results = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch {
    }
  }
  return results;
}

function extractPrompts(jsonlPath, limit) {
  const records = readJsonlFile(jsonlPath);
  const prompts = [];
  for (const record of records) {
    if (prompts.length >= limit) break;
    const role = record.role || (record.message && record.message.role);
    const content = record.content || (record.message && record.message.content);
    if (role === 'human' && typeof content === 'string' && content.trim().length > 0) {
      prompts.push(content.trim());
    } else if (role === 'human' && Array.isArray(content)) {
      const text = content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
      if (text.length > 0) prompts.push(text);
    }
  }
  return prompts;
}

function loadMetrics(metricsPath) {
  if (!metricsPath || !fs.existsSync(metricsPath)) return [];
  return readJsonlFile(metricsPath);
}

const limit = parseInt(opts.limit, 10) || 200;
const inputPaths = opts.jsonl.split(',').map((p) => p.trim());

const allPrompts = [];
for (const p of inputPaths) {
  const extracted = extractPrompts(p, limit - allPrompts.length);
  allPrompts.push(...extracted);
  if (allPrompts.length >= limit) break;
}

const metricsRecords = loadMetrics(opts.metrics);
const metricsMap = new Map();
for (const rec of metricsRecords) {
  if (rec.session_id && rec.skills) {
    const key = `${rec.session_id}-${rec.prompt_count}`;
    metricsMap.set(key, rec.skills);
  }
}

const output = allPrompts.map((prompt, i) => ({
  id: `real-${String(i + 1).padStart(3, '0')}`,
  prompt,
  changed_files: [],
  session_context: { alreadyLoadedSkills: [], lastStatusHash: null },
  expected: {
    skills: [],
    plan_mode: null,
    security_injection: null,
  },
  note: 'TODO: annotate expected fields manually',
}));

const outPath = path.resolve(opts.out);
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`Extracted ${output.length} prompts from ${inputPaths.length} file(s).`);
console.log(`Output written to: ${outPath}`);
console.log('Next step: annotate the "expected" fields in each entry, then add to golden-prompts.json.');
