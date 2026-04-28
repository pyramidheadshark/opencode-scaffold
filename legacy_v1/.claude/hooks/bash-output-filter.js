#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const RULES = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "filter_rules.json"), "utf8"));
    return Array.isArray(raw.rules) ? raw.rules : [];
  } catch (e) {
    process.stderr.write(`[bash-output-filter] rules load: ${e.message}\n`);
    return [];
  }
})();

function appendLog(cwd, entry) {
  try {
    const logsDir = path.join(cwd, ".claude", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, "filter-log.jsonl");
    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    process.stderr.write(`[bash-output-filter] log write: ${e.message}\n`);
  }
}

function main(inputStr, cwd) {
  let input = {};
  try { input = JSON.parse(inputStr); } catch { return { action: "continue" }; }

  if (input.tool_name !== "Bash") return { action: "continue" };

  const command = ((input.tool_input || {}).command || "").trimStart();
  if (!command) return { action: "continue" };

  try {
    const rule = RULES.find(r => command.startsWith(r.match));
    if (!rule) return { action: "continue" };

    const originalCommand = command;
    const safeAppend = rule.append.trimEnd().endsWith("|| true")
      ? rule.append
      : rule.append + " || true";
    const wrappedCommand = `{ ${originalCommand}; } ${safeAppend}`;

    appendLog(cwd, {
      ts: new Date().toISOString(),
      cmd_match: rule.match,
      original_bytes: Buffer.byteLength(originalCommand),
      filtered_cmd_bytes: Buffer.byteLength(wrappedCommand),
    });

    return { action: "continue", updatedInput: { command: wrappedCommand } };
  } catch (e) {
    process.stderr.write(`[bash-output-filter] filter error: ${e.message}\n`);
    return { action: "continue" };
  }
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main };
