#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const DEFAULT_THRESHOLD = 25;
const DEPS_REMINDER_INTERVAL = 20;

let _i18n;
function getI18n() {
  if (!_i18n) {
    try { _i18n = require("./i18n"); } catch { _i18n = null; }
  }
  return _i18n;
}

function loadLang(cwd) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(cwd, ".claude", "project-config.json"), "utf8"));
    return config.lang || "en";
  } catch { return "en"; }
}

function buildCheckpointPlan(lang) {
  const i18n = getI18n();
  if (i18n) return i18n.buildCheckpointPlanBlock(lang);
  return "## [AUTO CHECKPOINT — Plan Approved]\n" +
    "The plan was just approved (ExitPlanMode called). Before starting implementation,\n" +
    "write dev/status.md:\n" +
    "- Active phase marker\n" +
    "- What is about to be implemented\n" +
    "- Key architectural decisions from the plan\n" +
    "- Open questions / blockers\n\n" +
    "## [COMPACT REQUIRED BEFORE STEP 1]\n" +
    "Your FIRST AND ONLY action — execute IN ORDER:\n\n" +
    "Step 1 — Generate a Post-Compact Resume Message and display it:\n" +
    "```\n## Post-Compact Resume (paste this after /compact)\n" +
    "**Goal:** [session goal]\n**Plan:** [absolute path to plan file]\n" +
    "**Phase:** [current phase]\n**Files to read first:**\n1. [absolute path] — [what to look for]\n" +
    "**Next action:** [exact next step]\n**Key facts:** [critical non-obvious context]\n```\n\n" +
    "Step 2 — Tell the user: \"Run /compact, then paste the Resume Message as your next message.\"\n\n" +
    "Step 3 — WAIT. Do NOT read files or execute plan steps yet.";
}

function buildThresholdBlock(threshold, lang) {
  const i18n = getI18n();
  if (i18n) return i18n.buildThresholdCheckpointBlock(threshold, lang);
  return "## [AUTO CHECKPOINT — Activity Threshold]\n" +
    `${threshold}+ tool calls since last checkpoint. Before your next response,\n` +
    "update dev/status.md with current progress, decisions made, and next steps.\n\n" +
    "## [CONTEXT WARNING]\n" +
    "Context is filling up. Tell the user: \"Consider running /compact to preserve session continuity.\"";
}

function loadCache(cacheDir, sessionId) {
  const cachePath = path.join(cacheDir, `checkpoint-${sessionId}.json`);
  if (!fs.existsSync(cachePath)) return { tool_call_count: 0, last_checkpoint_count: 0, compact_signal_sent: false };
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return { tool_call_count: 0, last_checkpoint_count: 0, compact_signal_sent: false };
  }
}

function saveCache(cacheDir, sessionId, cache) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachePath = path.join(cacheDir, `checkpoint-${sessionId}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) { process.stderr.write(`[session-checkpoint] saveCache: ${e.message}\n`); }
}

function main(inputStr, cwd, _fs) {
  const threshold = parseInt(process.env.SCAFFOLD_COMPACT_THRESHOLD || String(DEFAULT_THRESHOLD), 10);
  let input = {};
  try { input = JSON.parse(inputStr); } catch { input = {}; }

  const toolName = input.tool_name || "unknown";
  const sessionId = input.session_id || "default";
  const lang = loadLang(cwd);

  const cacheDir = path.join(cwd, ".claude/cache");
  const cache = loadCache(cacheDir, sessionId);

  cache.tool_call_count = (cache.tool_call_count || 0) + 1;
  if (cache.last_checkpoint_count === undefined) cache.last_checkpoint_count = 0;

  let triggered = false;
  let isDepsTrigger = false;
  let checkpointBlock = null;

  if (toolName === "ExitPlanMode") {
    triggered = true;
    checkpointBlock = buildCheckpointPlan(lang);
    cache.compact_signal_sent = false;
  } else if (
    !cache.compact_signal_sent &&
    cache.tool_call_count - cache.last_checkpoint_count >= threshold
  ) {
    triggered = true;
    checkpointBlock = buildThresholdBlock(threshold, lang);
    cache.compact_signal_sent = true;
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
            isDepsTrigger = true;
            const i18n = getI18n();
            checkpointBlock = i18n
              ? i18n.buildDepsBrockersBlock(open, lang)
              : "## [OPEN BLOCKERS REMINDER]\n" +
                open.map(b => `- [${b.id}] ${b.description || "no description"}`).join("\n") +
                "\nConsider addressing these blockers or updating their status.";
          }
        }
      } catch (e) { process.stderr.write(`[session-checkpoint] deps blocker: ${e.message}\n`); }
    }
  }

  if (triggered) {
    if (isDepsTrigger) {
      cache.last_deps_reminder_count = cache.tool_call_count;
    } else {
      cache.last_checkpoint_count = cache.tool_call_count;
    }
  }

  saveCache(cacheDir, sessionId, cache);

  if (triggered) {
    return { continue: true, hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: checkpointBlock } };
  }
  return { continue: true };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main };
