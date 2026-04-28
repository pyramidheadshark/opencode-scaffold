#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { appendSessionEvent, deleteOldSessionLogs } = require("./session-utils");

function loadSessionCache(cwd, sessionId) {
  try {
    const p = path.join(cwd, ".claude", "cache", `session-${sessionId}.json`);
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function writeSessionEnd(cwd, sessionId) {
  if (!sessionId) return;
  try {
    const cache = loadSessionCache(cwd, sessionId);
    if (cache.snapshot_tag) {
      process.stderr.write(`→ Session snapshot: ${cache.snapshot_tag}\n`);
    }
    appendSessionEvent(cwd, sessionId, {
      type: "session_end",
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      snapshot_tag: cache.snapshot_tag || null,
      tool_call_count: cache.tool_call_count || null,
      weight: cache.weight || 0,
    });
    const logsDir = path.join(cwd, ".claude", "logs", "sessions");
    deleteOldSessionLogs(logsDir, 30);
  } catch (e) { process.stderr.write(`[quality-check] sessionEnd: ${e.message}\n`); }
}

function main(inputStr, cwd) {
  let input = {};
  try { input = JSON.parse(inputStr); } catch { }
  const sessionId = input.session_id || null;

  writeSessionEnd(cwd, sessionId);

  const pyprojectPath = path.join(cwd, "pyproject.toml");
  if (!fs.existsSync(pyprojectPath)) {
    return { continue: true };
  }

  let uvAvailable = false;
  try {
    const uvCheck = spawnSync("uv", ["--version"], { encoding: "utf8" });
    uvAvailable = !uvCheck.error && uvCheck.status === 0;
  } catch {
    uvAvailable = false;
  }

  const ruffCmd = uvAvailable ? "uv" : "ruff";
  const ruffArgs = uvAvailable ? ["run", "ruff", "check", ".", "--quiet"] : ["check", ".", "--quiet"];

  let ruffOk = true;
  process.stderr.write(">> ruff check...\n");
  try {
    const ruff = spawnSync(ruffCmd, ruffArgs, { cwd, encoding: "utf8" });
    if (ruff.error) {
      process.stderr.write("[quality-check] ruff not found — skipping. Install via: uv add --dev ruff\n");
    } else {
      ruffOk = ruff.status === 0;
      process.stderr.write(ruffOk ? "RUFF: OK\n" : "RUFF: issues found. Run 'uv run ruff check . --fix' to auto-fix.\n");
    }
  } catch {
    process.stderr.write("[quality-check] ruff not found — skipping. Install via: uv add --dev ruff\n");
  }

  const srcDir = path.join(cwd, "src");
  let mypyOk = true;
  if (fs.existsSync(srcDir)) {
    const mypyCmd = uvAvailable ? "uv" : "mypy";
    const mypyArgs = uvAvailable ? ["run", "mypy", "src/", "--quiet"] : ["src/", "--quiet"];

    process.stderr.write(">> mypy check...\n");
    try {
      const mypy = spawnSync(mypyCmd, mypyArgs, { cwd, encoding: "utf8" });
      if (mypy.error) {
        process.stderr.write("[quality-check] mypy not found — skipping. Install via: uv add --dev mypy\n");
      } else {
        mypyOk = mypy.status === 0;
        process.stderr.write(mypyOk ? "MYPY: OK\n" : "MYPY: type errors found.\n");
      }
    } catch {
      process.stderr.write("[quality-check] mypy not found — skipping. Install via: uv add --dev mypy\n");
    }
  }

  if (!ruffOk || !mypyOk) {
    process.stderr.write("\nQuality checks failed. Consider fixing before committing.\n");
    process.stderr.write("This does not block the session — it is a reminder only.\n");
  }

  return { continue: true };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main, writeSessionEnd };
