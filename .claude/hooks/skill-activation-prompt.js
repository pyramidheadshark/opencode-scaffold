#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { loadSkillRules, buildInjections, buildOutput } = require("./skill-activation-logic");

const CACHE_DIR = path.join(process.cwd(), ".claude/cache");

function loadSessionCache(sessionId) {
  const cachePath = path.join(CACHE_DIR, `session-${sessionId}.json`);
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return {};
  }
}

function saveSessionCache(sessionId, cache) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `session-${sessionId}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

const input = JSON.parse(fs.readFileSync(0, "utf8"));
const prompt = input.prompt || "";
const sessionId = input.session_id || "default";
const cwd = process.cwd();

const rulesPath = path.join(cwd, ".claude/skills/skill-rules.json");
const rules = loadSkillRules(fs, rulesPath);

if (!rules) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const changedFiles = (() => {
  try {
    const raw = execSync("git status --porcelain", { cwd, encoding: "utf-8" }).trim();
    if (!raw) return [];
    return raw.split("\n").filter(Boolean).map((l) => l.slice(3).trim());
  } catch {
    return [];
  }
})();

const cache = loadSessionCache(sessionId);
const sessionContext = {
  alreadyLoadedSkills: cache.loaded_skills || [],
  lastStatusHash: cache.last_status_hash || null,
};

const { injections, matchedSkills, statusHash } = buildInjections(fs, path, cwd, prompt, changedFiles, rules, sessionContext);

const PLAN_MODE_KEYWORDS = [
  // Russian — planning intent (high-confidence imperatives/phrases)
  "план", "планир", "запланир", "спланируем", "спланируй", "давай спланируем",
  // Russian — scope signals (specific enough to indicate multi-step work)
  "многоступенчат", "поэтапн", "пошагов", "составь план", "разработай план",
  "рефакторинг", "рефактор", "перепиши", "переработ",
  "архитектур", "мигрир", "интегрир", "реализ", "разработай",
  "фичу", "фичи",
  "внедри", "оптимизир", "разверни",
  // English — planning intent
  "planning", "multi-step", "multi-phase", "step-by-step", "let's plan",
  // English — scope signals (specific multi-step verbs/nouns only)
  "refactor", "rewrite", "migrate", "migration", "redesign", "rollout", "overhaul", "sprint",
];
// Informational/question prompts: skip plan-mode even if keywords present
const QUESTION_PREFIXES = [
  "what", "how", "why", "explain", "show", "describe", "tell me", "can you explain",
  "что ", "как ", "почему", "зачем", "объясни", "расскажи", "покажи", "в чём",
  "можешь", "можно",
];
const promptLower = prompt.toLowerCase();
const isQuestion = QUESTION_PREFIXES.some((q) => promptLower.startsWith(q));
const isPlanIntent = !isQuestion && PLAN_MODE_KEYWORDS.some((kw) => promptLower.includes(kw));
const SECURITY_PATTERNS = [
  "auth", "login", "password", "token", "secret",
  "db", "database", "query", "session", "credential",
  "api", "endpoint", "user", "permission", "role",
];
const hasSecurityFiles = changedFiles.some((f) =>
  SECURITY_PATTERNS.some((p) => f.toLowerCase().includes(p))
);
if (hasSecurityFiles) {
  injections.push(
    "## 🔒 Security Heads-Up\n" +
    "Changed files include security-sensitive code (auth/DB/API/user).\n" +
    "Run `/security-review` before committing."
  );
}

if (isPlanIntent) {
  injections.push(
    "## 🚨 MANDATORY: Enter Plan Mode Now\n" +
    "This prompt requires plan mode — do not skip this step.\n" +
    "You MUST call the EnterPlanMode tool IMMEDIATELY, before reading files, writing code, or taking any action.\n" +
    "Proceeding without plan mode violates CLAUDE.md workflow rules.\n" +
    "Steps:\n" +
    "1. Call EnterPlanMode tool now\n" +
    "2. Explore the codebase and design the implementation plan\n" +
    "3. Present the plan and wait for explicit user approval\n" +
    "4. Only then call ExitPlanMode and begin implementation\n" +
    "Before writing the plan, ask the user:\n" +
    "• Scope: which files/modules are in scope? What is explicitly OUT of scope?\n" +
    "• Constraints: backward compatibility, deployment limits, deadlines?\n" +
    "• Success criteria: how do we know this task is done?"
  );
}

const updatedLoadedSkills = [...new Set([...(cache.loaded_skills || []), ...matchedSkills])];
try {
  saveSessionCache(sessionId, {
    session_id: sessionId,
    loaded_skills: updatedLoadedSkills,
    last_status_hash: statusHash,
    prompt_count: (cache.prompt_count || 0) + 1,
  });
} catch {
}

const logsDir = path.join(cwd, ".claude/logs");
try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const promptCount = (cache.prompt_count || 0) + 1;
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    session_id: sessionId,
    repo: path.basename(cwd),
    prompt_count: promptCount,
    skills: matchedSkills,
    skills_cumulative: updatedLoadedSkills,
    changed_files_count: changedFiles.length,
    status_injected: injections.some((i) => i.startsWith("## Project Status")),
  });
  fs.appendFileSync(path.join(logsDir, "skill-metrics.jsonl"), entry + "\n", "utf8");
} catch {
}

process.stdout.write(JSON.stringify(buildOutput(injections)));
