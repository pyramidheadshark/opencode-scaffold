#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const THRESHOLD = 50;
const DEPS_REMINDER_INTERVAL = 20;

const CHECKPOINT_PLAN =
  "## [AUTO CHECKPOINT — Plan Approved]\n" +
  "The plan was just approved (ExitPlanMode called). Before starting implementation,\n" +
  "write dev/status.md:\n" +
  "- Active phase marker\n" +
  "- What is about to be implemented\n" +
  "- Key architectural decisions from the plan\n" +
  "- Open questions / blockers";

const CHECKPOINT_THRESHOLD =
  "## [AUTO CHECKPOINT — Activity Threshold]\n" +
  "50+ tool calls since last checkpoint. Before your next response,\n" +
  "update dev/status.md with current progress, decisions made, and next steps.";

function loadCache(cacheDir, sessionId) {
  const cachePath = path.join(cacheDir, `checkpoint-${sessionId}.json`);
  if (!fs.existsSync(cachePath)) return { tool_call_count: 0, last_checkpoint_count: 0 };
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return { tool_call_count: 0, last_checkpoint_count: 0 };
  }
}

function saveCache(cacheDir, sessionId, cache) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachePath = path.join(cacheDir, `checkpoint-${sessionId}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) { process.stderr.write(`[session-checkpoint] saveCache: ${e.message}\n`); }
}

function main(inputStr, cwd) {
  let input = {};
  try { input = JSON.parse(inputStr); } catch { input = {}; }

  const toolName = input.tool_name || "unknown";
  const sessionId = input.session_id || "default";

  const cacheDir = path.join(cwd, ".claude/cache");
  const cache = loadCache(cacheDir, sessionId);

  cache.tool_call_count = (cache.tool_call_count || 0) + 1;
  if (cache.last_checkpoint_count === undefined) cache.last_checkpoint_count = 0;

  let triggered = false;
  let checkpointBlock = null;

  if (toolName === "ExitPlanMode") {
    triggered = true;
    checkpointBlock = CHECKPOINT_PLAN;
  } else if (cache.tool_call_count - cache.last_checkpoint_count >= THRESHOLD) {
    triggered = true;
    checkpointBlock = CHECKPOINT_THRESHOLD;
  }

  if (!triggered) {
    const lastDepsReminder = cache.last_deps_reminder_count || 0;
    if (cache.tool_call_count - lastDepsReminder >= DEPS_REMINDER_INTERVAL) {
      try {
        const depsPath = path.join(cwd, "deps.yaml");
        if (fs.existsSync(depsPath)) {
          const raw = fs.readFileSync(depsPath, "utf8");
          let parseBlockers;
          try {
            parseBlockers = require(path.join(cwd, "..", "lib", "yaml-parser.js")).parseBlockers;
          } catch {
            parseBlockers = null;
          }
          let open = [];
          if (parseBlockers) {
            open = parseBlockers(raw).filter(b => b.status === "open");
          }
          if (open.length > 0) {
            triggered = true;
            checkpointBlock = "## [OPEN BLOCKERS REMINDER]\n" +
              open.map(b => `- [${b.id}] ${b.description || "no description"}`).join("\n") +
              "\nConsider addressing these blockers or updating their status.";
          }
        }
      } catch (e) { process.stderr.write(`[session-checkpoint] deps blocker: ${e.message}\n`); }
    }
  }

  if (triggered) {
    if (checkpointBlock && checkpointBlock.includes("BLOCKER")) {
      cache.last_deps_reminder_count = cache.tool_call_count;
    } else {
      cache.last_checkpoint_count = cache.tool_call_count;
    }
  }

  saveCache(cacheDir, sessionId, cache);

  if (triggered) {
    return { continue: true, system_prompt_addition: checkpointBlock };
  }
  return { continue: true };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main };
