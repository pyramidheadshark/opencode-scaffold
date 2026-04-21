#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const DEFAULT_THRESHOLD = 30;
const ENV_THRESHOLD = "SCAFFOLD_CONTEXT_THRESHOLD";

function getModelShortName(cwd) {
  try {
    const p = path.join(cwd, ".claude", "settings.json");
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    const m = s.model || "";
    if (m.includes("haiku"))  return "hai";
    if (m.includes("opus"))   return "ops";
    if (m.includes("sonnet")) return "son";
    return "";
  } catch { return ""; }
}

function main(inputStr, cwd) {
  const threshold = parseInt(process.env[ENV_THRESHOLD] || String(DEFAULT_THRESHOLD), 10);
  let input = {};
  try { input = JSON.parse(inputStr || "{}"); } catch { input = {}; }

  const sessionId = input.session_id || "default";
  const ctxWindow = input.context_window || {};
  const remaining = ctxWindow.remaining_percentage;

  if (remaining === undefined || remaining === null) {
    process.stdout.write("");
    return;
  }

  const roundedRemaining = Math.round(remaining);
  const critical = roundedRemaining <= threshold;

  const cacheDir = path.join(cwd, ".claude", "cache");
  const cachePath = path.join(cacheDir, `checkpoint-${sessionId}.json`);
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cachePath, "utf8")); } catch {}
  cache.context_remaining_pct = roundedRemaining;
  cache.context_critical = critical;
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  } catch {}

  const icon = critical ? "⚠ " : "";
  const modelTag = getModelShortName(cwd);
  const modelSuffix = modelTag ? ` | ${modelTag}` : "";
  process.stdout.write(`ctx: ${icon}${roundedRemaining}%${modelSuffix}`);
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  main(inputStr, process.cwd());
}
module.exports = { main, getModelShortName };
