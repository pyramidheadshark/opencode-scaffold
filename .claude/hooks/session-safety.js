#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { sanitizeSessionId } = require("./session-utils");

const PATTERNS = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "destructive-patterns.json"), "utf8"));
    const validate = (arr, label) => (arr || []).filter(p => {
      try { new RegExp(p, "i"); return true; } catch (e) {
        process.stderr.write(`[session-safety] invalid ${label} regex "${p}": ${e.message}\n`);
        return false;
      }
    });
    return {
      critical: validate(raw.critical, "critical"),
      moderate: validate(raw.moderate, "moderate"),
      safe_targets: raw.safe_targets || [],
    };
  } catch (e) {
    process.stderr.write(`[session-safety] patterns load: ${e.message}\n`);
    return { critical: [], moderate: [], safe_targets: [] };
  }
})();

function isSafeTarget(command, safeTargets) {
  const normalized = command.replace(/\\/g, "/");
  return safeTargets.some(t => {
    if (t.startsWith("/")) return normalized.includes(t);
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[\\s/])${esc}([/\\s]|$)`).test(normalized);
  });
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
  } catch (e) { process.stderr.write(`[session-safety] saveCache: ${e.message}\n`); }
}

function createSnapshot(cwd, sessionId, count) {
  const idShort = sanitizeSessionId(sessionId).slice(0, 8);
  const tagName = count === 1 ? `claude/s-${idShort}` : `claude/s-${idShort}-${count}`;
  const result = spawnSync("git", ["tag", tagName, "HEAD"],
    { cwd, encoding: "utf8", timeout: 5000 });
  if (result.status !== 0 || result.error) return null;
  return tagName;
}

function main(inputStr, cwd) {
  let input = {};
  try { input = JSON.parse(inputStr); } catch { }

  const command = ((input.tool_input || {}).command || "").trim();
  const sessionId = sanitizeSessionId(input.session_id || "unknown");

  if (isOutOfCwd(command, cwd)) {
    return { action: "block", reason: "Blocked: operation targets location outside project directory. Run manually if intended." };
  }

  const level = classifyCommand(command, PATTERNS);

  if (level === "CRITICAL") {
    const cache = loadSessionCache(cwd, sessionId);
    const existingCount = cache.snapshot_count !== undefined
      ? cache.snapshot_count
      : (cache.snapshot_taken ? 1 : 0);
    const count = existingCount + 1;
    const tag = createSnapshot(cwd, sessionId, count);
    if (tag) {
      const notification = count === 1
        ? `## [SAFETY SNAPSHOT]\nRecovery point created before destructive command.\nTag: \`${tag}\`  →  restore: \`git reset --hard ${tag}\``
        : `## [SAFETY SNAPSHOT ${count}]\nAdditional recovery point created.\nTag: \`${tag}\`  →  restore: \`git reset --hard ${tag}\``;
      saveSessionCache(cwd, sessionId, {
        snapshot_count: count,
        snapshot_tag: tag,
        pending_notification: notification,
      });
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
