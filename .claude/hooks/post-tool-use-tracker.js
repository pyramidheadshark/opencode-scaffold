#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

function main(inputStr, cwd) {
  let input = {};
  try { input = JSON.parse(inputStr); } catch { input = {}; }

  const toolName = input.tool_name || "unknown";
  const sessionId = input.session_id || "unknown";
  const isError = Boolean((input.tool_response || {}).is_error);
  const repo = path.basename(cwd);

  const logsDir = path.join(cwd, ".claude/logs");
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      repo,
      tool: toolName,
      is_error: isError,
    });
    fs.appendFileSync(path.join(logsDir, "tool-usage.jsonl"), entry + "\n", "utf8");
  } catch { /* logging is non-critical */ }

  return { continue: true };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main };
