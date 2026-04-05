#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { WEIGHTS, appendSessionEvent } = require("./session-utils");

function loadSessionCache(cwd, sessionId) {
  try {
    const p = path.join(cwd, ".claude", "cache", `session-${sessionId}.json`);
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveSessionCache(cwd, sessionId, data) {
  try {
    const cacheDir = path.join(cwd, ".claude", "cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const p = path.join(cacheDir, `session-${sessionId}.json`);
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { /* first write */ }
    fs.writeFileSync(p, JSON.stringify({ ...existing, ...data }, null, 2), "utf8");
  } catch (e) { process.stderr.write(`[post-tool-use] saveCache: ${e.message}\n`); }
}

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
  } catch (e) { process.stderr.write(`[post-tool-use] logWrite: ${e.message}\n`); }

  try {
    const cache = loadSessionCache(cwd, sessionId);

    if (!cache.session_initialized) {
      appendSessionEvent(cwd, sessionId, {
        type: "session_start",
        session_id: sessionId,
        repo,
        platform: process.platform,
        timestamp: new Date().toISOString(),
      });
      saveSessionCache(cwd, sessionId, { session_initialized: true });
    }

    const weight = (cache.weight || 0) + (WEIGHTS[toolName] || 0);
    saveSessionCache(cwd, sessionId, { weight });

    if (toolName === "Write" || toolName === "Edit") {
      const filePath = ((input.tool_input || {}).file_path || (input.tool_input || {}).path) || null;
      appendSessionEvent(cwd, sessionId, {
        type: "file_change",
        tool: toolName,
        path: filePath,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) { process.stderr.write(`[post-tool-use] tracking: ${e.message}\n`); }

  return { continue: true };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main };
