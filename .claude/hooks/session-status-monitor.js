#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const DEFAULT_THRESHOLD = 20;
const ENV_THRESHOLD = "SCAFFOLD_CONTEXT_THRESHOLD";

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

  const critical = remaining <= threshold;

  const cacheDir = path.join(cwd, ".claude", "cache");
  const cachePath = path.join(cacheDir, `checkpoint-${sessionId}.json`);
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cachePath, "utf8")); } catch {}
  cache.context_remaining_pct = Math.round(remaining);
  cache.context_critical = critical;
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  } catch {}

  const icon = critical ? "⚠ " : "";
  process.stdout.write(`ctx: ${icon}${Math.round(remaining)}%`);
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  main(inputStr, process.cwd());
}
module.exports = { main };
