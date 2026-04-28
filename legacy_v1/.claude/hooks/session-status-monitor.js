#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const DEFAULT_THRESHOLD = 30;
const ENV_THRESHOLD = "SCAFFOLD_CONTEXT_THRESHOLD";
const ENV_PLAIN = "SCAFFOLD_STATUSLINE_PLAIN";

const MODEL_MAP = {
  "claude-sonnet-4-6":         { label: "Sonnet 4.6", emoji: "🔵", short: "son" },
  "claude-haiku-4-5-20251001": { label: "Haiku 4.5",  emoji: "🟢", short: "hai" },
  "claude-opus-4-7":           { label: "Opus 4.7",   emoji: "🟣", short: "ops" },
};

function readSettings(cwd) {
  try {
    const p = path.join(cwd, ".claude", "settings.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return null; }
}

function getModelInfo(cwd) {
  const s = readSettings(cwd);
  if (!s || !s.model) return null;
  return MODEL_MAP[s.model] || { label: s.model, emoji: "", short: "" };
}

function readQuotaCache() {
  try {
    const os = require("os");
    const p = path.join(os.homedir(), ".claude", "quota-cache.json");
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!raw.available) return null;
    const budgetPath = path.join(os.homedir(), ".claude", "quota-budget.json");
    let budget = { weekly_usd: 100, warn_threshold_pct: 80, block_threshold_pct: 95 };
    if (fs.existsSync(budgetPath)) {
      try { budget = { ...budget, ...JSON.parse(fs.readFileSync(budgetPath, "utf8")) }; } catch {}
    }
    const pct = budget.weekly_usd > 0
      ? Math.round((raw.weekly_usd / budget.weekly_usd) * 1000) / 10
      : 0;
    let state = "ok";
    if (pct >= budget.block_threshold_pct) state = "block";
    else if (pct >= budget.warn_threshold_pct) state = "warn";
    return { pct, state };
  } catch { return null; }
}

function readWeeklyCost() {
  try {
    const os = require("os");
    const p = path.join(os.homedir(), ".claude", "quota-cache.json");
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!raw.available || typeof raw.weekly_usd !== "number") return null;
    return { weekly_usd: raw.weekly_usd };
  } catch { return null; }
}

function readBlockStatus() {
  try {
    const os = require("os");
    const p = path.join(os.homedir(), ".claude", "block-cache.json");
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (Date.now() - raw.cached_at > 2 * 60 * 1000) return null;
    if (!raw.available) return null;
    return { usedPct: raw.usedPct, remainingMinutes: raw.remainingMinutes };
  } catch { return null; }
}

function formatContext(roundedRemaining, critical, plain) {
  if (plain) {
    const icon = critical ? "! " : "";
    return `Context: ${icon}${roundedRemaining}%`;
  }
  const icon = critical ? "⚠ " : "";
  return `Context: ${icon}${roundedRemaining}%`;
}

function formatModel(info, plain) {
  if (!info) return "";
  const overrideMark = info.override ? (plain ? " (!)" : " ⚡") : "";
  if (plain) return ` | ${info.short || info.label}${overrideMark}`;
  return ` │ ${info.emoji ? info.emoji + " " : ""}${info.label}${overrideMark}`;
}

function extractRuntimeModelId(input) {
  if (!input || !input.model) return null;
  if (typeof input.model === "string") return input.model;
  if (typeof input.model === "object") {
    return input.model.id || input.model.display_name || null;
  }
  return null;
}

function resolveModelInfo(input, cwd) {
  const runtimeId = extractRuntimeModelId(input);
  const settings = readSettings(cwd);
  const settingsId = settings && settings.model;

  if (runtimeId) {
    const base = MODEL_MAP[runtimeId] || { label: runtimeId, emoji: "", short: "" };
    const override = Boolean(settingsId && settingsId !== runtimeId);
    return { ...base, override };
  }
  if (settingsId) {
    const base = MODEL_MAP[settingsId] || { label: settingsId, emoji: "", short: "" };
    return { ...base, override: false };
  }
  return null;
}

function formatQuota(quota, plain) {
  if (!quota) return "";
  if (plain) {
    const marker = quota.state === "block" ? "!" : (quota.state === "warn" ? "~" : "");
    return ` | Week: ${marker}${quota.pct}%`;
  }
  const icon = quota.state === "block" ? "🔴" : (quota.state === "warn" ? "🟡" : "🟢");
  return ` │ ${icon} Week: ${quota.pct}%`;
}

function formatBlock(block, plain) {
  if (!block || block.usedPct === null || block.usedPct === undefined) return "";
  const pct = block.usedPct;
  const mins = block.remainingMinutes;
  const minsSuffix = (mins !== null && mins !== undefined) ? `${mins}m` : "";
  if (plain) {
    return minsSuffix ? ` | 5h: ${pct}% ${minsSuffix}` : ` | 5h: ${pct}%`;
  }
  return minsSuffix ? ` │ 5h: ${pct}% ⏱${minsSuffix}` : ` │ 5h: ${pct}%`;
}

function formatWeeklyCost(cost, plain) {
  if (!cost || typeof cost.weekly_usd !== "number") return "";
  const usd = cost.weekly_usd;
  const formatted = usd >= 100 ? usd.toFixed(0) : usd.toFixed(1);
  if (plain) return ` | $${formatted}`;
  return ` │ $${formatted}`;
}

function main(inputStr, cwd) {
  const threshold = parseInt(process.env[ENV_THRESHOLD] || String(DEFAULT_THRESHOLD), 10);
  const plain = process.env[ENV_PLAIN] === "1" || process.env[ENV_PLAIN] === "true";
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

  const contextPart = formatContext(roundedRemaining, critical, plain);
  const modelPart = formatModel(resolveModelInfo(input, cwd), plain);
  const blockPart = formatBlock(readBlockStatus(), plain);
  const costPart = formatWeeklyCost(readWeeklyCost(), plain);
  process.stdout.write(`${contextPart}${modelPart}${blockPart}${costPart}`);
}

function getModelShortName(cwd) {
  const info = getModelInfo(cwd);
  return info ? info.short : "";
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  main(inputStr, process.cwd());
}

module.exports = { main, getModelShortName, getModelInfo, resolveModelInfo, extractRuntimeModelId, readQuotaCache, readWeeklyCost, readBlockStatus, formatContext, formatModel, formatQuota, formatBlock, formatWeeklyCost, MODEL_MAP };
