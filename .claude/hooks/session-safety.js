#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function loadPatterns() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "destructive-patterns.json"), "utf8"));
  } catch {
    return { critical: [], moderate: [], safe_targets: [] };
  }
}

function isSafeTarget(command, safeTargets) {
  const normalized = command.replace(/\\/g, "/");
  return safeTargets.some(t => normalized.includes(t));
}

function classifyCommand(command, patterns) {
  const cmd = (command || "").trim();
  if (!cmd) return "SAFE";

  const isCritical = patterns.critical.some(p => new RegExp(p, "i").test(cmd));
  if (isCritical) {
    if (isSafeTarget(cmd, patterns.safe_targets)) return "SAFE";
    return "CRITICAL";
  }

  const isModerate = patterns.moderate.some(p => new RegExp(p, "i").test(cmd));
  if (isModerate) return "MODERATE";

  return "SAFE";
}

function isOutOfCwd(command, cwd) {
  const catastrophic = [
    /rm\s+-[rRfFrfRF]+\s+\/\s*$/,
    /rm\s+-[rRfFrfRF]+\s+~\s*$/,
    /rm\s+-[rRfFrfRF]+\s+\/[a-z]\/\s*$/,
  ];
  return catastrophic.some(p => p.test((command || "").trim()));
}

function loadSessionCache(cwd, sessionId) {
  try {
    const p = path.join(cwd, ".claude", "cache", `session-${sessionId}.json`);
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function saveSessionCache(cwd, sessionId, data) {
  try {
    const cacheDir = path.join(cwd, ".claude", "cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const p = path.join(cacheDir, `session-${sessionId}.json`);
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(p, "utf8")); } catch { }
    fs.writeFileSync(p, JSON.stringify({ ...existing, ...data }, null, 2), "utf8");
  } catch { }
}

function createSnapshot(cwd, sessionId) {
  const idShort = sessionId.slice(0, 8);
  const tagName = `claude/s-${idShort}`;
  const result = spawnSync("git", ["tag", tagName, "HEAD"], { cwd, encoding: "utf8" });
  if (result.status !== 0) return null;
  return tagName;
}

function main(inputStr, cwd) {
  let input = {};
  try { input = JSON.parse(inputStr); } catch { }

  const command = ((input.tool_input || {}).command || "").trim();
  const sessionId = input.session_id || "default";

  if (isOutOfCwd(command, cwd)) {
    return { action: "block", reason: "Blocked: operation targets location outside project directory. Run manually if intended." };
  }

  const patterns = loadPatterns();
  const level = classifyCommand(command, patterns);

  if (level === "CRITICAL") {
    const cache = loadSessionCache(cwd, sessionId);
    if (!cache.snapshot_taken) {
      const tag = createSnapshot(cwd, sessionId);
      saveSessionCache(cwd, sessionId, { snapshot_taken: true, snapshot_tag: tag });
    }
  }

  return { action: "continue" };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main, classifyCommand, isSafeTarget, isOutOfCwd };
