#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CONFIG_FILE = ".claude/project-config.json";

function resolveI18n() {
  try {
    const i18nPath = path.join(__dirname, "..", "..", "lib", "i18n.js");
    if (fs.existsSync(i18nPath)) return require(i18nPath);
  } catch (e) { process.stderr.write(`[session-start] i18n: ${e.message}\n`); }
  return null;
}

function detectPythonCmd(plat) {
  if ((plat || process.platform) === "win32") return "python";
  try {
    execSync("python3 --version", { stdio: "ignore" });
    return "python3";
  } catch (e) {
    return "python";
  }
}

function detectShell() {
  if (process.env.SHELL) return path.basename(process.env.SHELL);
  if (process.platform === "win32") return "bash";
  return "sh";
}

function loadConfig(cwd) {
  const configPath = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (e) {
    process.stderr.write(`[session-start] config parse: ${e.message}\n`);
    return null;
  }
}

function saveConfig(cwd, config) {
  const configPath = path.join(cwd, CONFIG_FILE);
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

function buildEnvBlock(platform, pythonCmd, shell, sessionCount) {
  return `## Session Environment\nPlatform: ${platform} | Shell: ${shell} | Python: ${pythonCmd} | Sessions: ${sessionCount}`;
}

const ONBOARDING_BLOCK = `## Project Onboarding Required
First Claude Code session detected. Ask the user these questions before starting work:
1. Main goal of this session?
2. Which files or modules are in scope today?
3. Any blockers or known issues from previous work?
4. Any project-specific constraints beyond CLAUDE.md?
5. Preferred response language for this project?
Save key answers to .claude/project-config.json.`;

const WINDOWS_RULES_BLOCK = `## Windows Compatibility Rules
Platform is win32. Apply to ALL generated code and terminal instructions:
1. Python command: use \`python\` (not \`python3\`). Detected python_cmd is saved in .claude/project-config.json.
2. Shell: Claude Code Bash tool runs in Git Bash — use Unix syntax for tool calls. For user-facing terminal commands in docs/README/scripts, always provide PowerShell syntax.
3. Encoding: ALWAYS specify encoding explicitly in all file I/O:
   - Python: \`open(..., encoding="utf-8")\` and \`Path(...).read_text(encoding="utf-8")\`
   - Never use bare \`open()\` without encoding — Windows defaults to cp1251/cp1252 which corrupts UTF-8 files
4. Terminal encoding: run \`chcp 65001\` before starting Claude Code in CMD/PowerShell, or add to PowerShell profile: \`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\`. Recommended: launch Claude Code from Git Bash to avoid encoding issues entirely.`;

function resolveYamlParser() {
  try {
    const parserPath = path.join(__dirname, "..", "..", "lib", "yaml-parser.js");
    if (fs.existsSync(parserPath)) return require(parserPath).parseSimpleYaml;
  } catch {}
  return null;
}

function parseSimpleYamlFallback(text) {
  const result = {};
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const m = line.match(/^(\w[\w_-]*):\s*(.+)$/);
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return result;
}

function parseSimpleYaml(text) {
  const sharedParser = resolveYamlParser();
  if (sharedParser) return sharedParser(text);
  return parseSimpleYamlFallback(text);
}

function buildDepsBlock(fsModule, cwd) {
  const depsPath = path.join(cwd, "deps.yaml");
  if (!fsModule.existsSync(depsPath)) return null;
  try {
    const raw = fsModule.readFileSync(depsPath, "utf8");
    const deps = parseSimpleYaml(raw);
    const lines = [];
    if (deps.project) lines.push(`Project: ${deps.project}`);
    if (Array.isArray(deps.depends_on) && deps.depends_on.length > 0) {
      lines.push("Dependencies:");
      for (const d of deps.depends_on) {
        if (typeof d === "object") lines.push(`  - ${d.repo} (${d.type || "unknown"}): ${d.description || ""}`);
      }
    }
    if (Array.isArray(deps.blockers) && deps.blockers.length > 0) {
      const open = deps.blockers.filter(b => typeof b === "object" && b.status === "open");
      if (open.length > 0) {
        lines.push(`Open Blockers (${open.length}):`);
        for (const b of open) lines.push(`  - [${b.id}] ${b.description} (since ${b.since || "?"})`);
      }
    }
    return lines.length > 1 ? "## [DEPENDENCIES]\n" + lines.join("\n") : null;
  } catch (e) {
    process.stderr.write(`[session-start] deps.yaml: ${e.message}\n`);
    return null;
  }
}

function buildInfraBlock(fsModule, cwd) {
  for (const candidate of ["INFRA.yaml", ".claude/INFRA.yaml"]) {
    const p = path.join(cwd, candidate);
    if (!fsModule.existsSync(p)) continue;
    try {
      const raw = fsModule.readFileSync(p, "utf8");
      const infra = parseSimpleYaml(raw);
      const vmCount = Array.isArray(infra.vms) ? infra.vms.length : (typeof infra.vms === "object" ? Object.keys(infra.vms).length : 0);
      const svcCount = Array.isArray(infra.services) ? infra.services.length : (typeof infra.services === "object" ? Object.keys(infra.services).length : 0);
      const rules = Array.isArray(infra.rules) ? infra.rules.filter(r => typeof r === "string") : [];
      const lines = [`## [INFRASTRUCTURE]`, `${vmCount} VM(s), ${svcCount} service(s). Full manifest: use /infra command.`];
      if (rules.length > 0) {
        lines.push("Rules:");
        for (const r of rules) lines.push(`  - ${r}`);
      }
      return lines.join("\n");
    } catch (e) {
      process.stderr.write(`[session-start] INFRA.yaml: ${e.message}\n`);
      return null;
    }
  }
  return null;
}

const COMMIT_RULES_REMINDER_BLOCK = `## Commit Rules Reminder (periodic)
One commit = one logical stage. Key rules:
- Subject line only, ≤72 chars. No body unless "why" is non-obvious.
- NEVER add Co-Authored-By, Generated-with, or any AI attribution — hard rule.
- Max 2–3 commits per session. Commit when a stage is complete, not after every file.`;

const LIGHT_AGENTS_BLOCK = `## Light Agents Active
For status/backlog updates, use the \`status-updater\` agent (cost-optimized model).
Invoke: "Use the status-updater agent to update dev/status.md."`;

function buildContractMissingBlock(fsModule, cwd, sessionCount) {
  if (sessionCount <= 1) return null;
  const today = new Date().toISOString().split("T")[0];
  const contractFile = path.join(cwd, "dev", "active", `session-${today}.md`);
  if (fsModule.existsSync(contractFile)) return null;
  return `## [SESSION CONTRACT MISSING]\nNo session contract for today (${today}).\nRun: \`claude-scaffold new-session "your session goal"\``;
}

function buildDiscoverySuggestionBlock(fsModule, cwd, sessionCount) {
  if (sessionCount !== 1) return null;
  const rulesPath = path.join(cwd, '.claude', 'skills', 'skill-rules.json');
  if (!fsModule.existsSync(rulesPath)) return null;
  try {
    const rules = JSON.parse(fsModule.readFileSync(rulesPath, 'utf8'));
    if (!rules.rules || rules.rules.length >= 4) return null;
  } catch { return null; }

  const detected = [];
  if (fsModule.existsSync(path.join(cwd, 'package.json'))) detected.push('Node.js');
  if (fsModule.existsSync(path.join(cwd, 'pyproject.toml'))) detected.push('Python');
  if (fsModule.existsSync(path.join(cwd, 'Cargo.toml'))) detected.push('Rust');
  if (fsModule.existsSync(path.join(cwd, 'go.mod'))) detected.push('Go');

  const stackStr = detected.length > 0 ? `Detected: ${detected.join(', ')}.` : '';
  return `## [SKILL DISCOVERY]\nNew project with minimal skills installed. ${stackStr}\nRun: \`claude-scaffold discover\` to find relevant skills for this project.`;
}

function buildLocalizedBlocks(lang) {
  const i18n = resolveI18n();
  if (!i18n || lang === "en" || !lang) {
    return { onboarding: ONBOARDING_BLOCK, windows: WINDOWS_RULES_BLOCK };
  }
  return {
    onboarding: i18n.buildOnboardingBlock(lang),
    windows: i18n.buildWindowsRulesBlock(lang),
  };
}

function loadSettings(cwd, fsModule) {
  const p = path.join(cwd, ".claude", "settings.json");
  if (!fsModule.existsSync(p)) return null;
  try {
    return JSON.parse(fsModule.readFileSync(p, "utf8"));
  } catch (e) {
    process.stderr.write(`[session-start] settings.json: ${e.message}\n`);
    return null;
  }
}

function loadRegistryEntry(cwd, fsModule) {
  try {
    const os = require("os");
    const candidates = [
      path.join(cwd, "deployed-repos.json"),
      path.join(os.homedir(), ".claude", "deployed-repos.json"),
    ];
    for (const p of candidates) {
      if (fsModule.existsSync(p)) {
        const registry = JSON.parse(fsModule.readFileSync(p, "utf8"));
        const entry = (registry.deployed || []).find(e => path.resolve(e.path) === path.resolve(cwd));
        if (entry) return { entry, activeMode: registry.active_mode || null };
      }
    }
  } catch { /* best-effort */ }
  return { entry: null, activeMode: null };
}

function buildHubModeGuideBlock(baseProfile, activeMode, lang) {
  if (baseProfile !== "power") return null;
  const mode = activeMode || "default";
  if (lang === "ru") {
    return `## [ГИД ПО РЕЖИМАМ — HUB REPO]
Это **hub-репо** (base_profile: power). Текущий активный режим: \`${mode}\`.

**Доступные режимы scaffold:**

| Режим | power-репо | standard-репо | balanced-репо | Когда использовать |
|-------|-----------|---------------|---------------|--------------------|
| \`default\` | Sonnet 4.6 | Haiku 4.5 | Haiku 4.5 | Обычная разработка |
| \`economy\` | Haiku 4.5 | Haiku 4.5 | Haiku 4.5 | Квота Sonnet кончается, простые задачи |
| \`no-sonnet\` | **Opus 4.7** | Haiku 4.5 | **Opus 4.7** | Sonnet недоступен, критические решения требуют Opus |

**Твоя роль как hub-агента:**
- Ты работаешь в репозитории стратегического значения (hub) — поэтому у тебя повышенный «мыслительный бюджет»
- Если видишь задачу, требующую **более мощной модели** (архитектура, критический рефакторинг, сложный ML) — предложи пользователю переключиться на \`no-sonnet\` (Opus для hub)
- Если видишь задачу, подходящую под **экономный режим** (рутинная документация, простые правки) — предложи \`economy\`
- Переключение: команда \`claude-scaffold mode <режим>\` или через \`/mode-switch\` slash command
- После переключения напомни, что текущую сессию нужно перезапустить`;
  }
  return `## [MODE ROUTING GUIDE — HUB REPO]
This is a **hub repo** (base_profile: power). Active mode: \`${mode}\`.

**Available scaffold modes:**

| Mode | power repos | standard repos | balanced repos | When to use |
|------|------------|----------------|----------------|-------------|
| \`default\` | Sonnet 4.6 | Haiku 4.5 | Haiku 4.5 | Regular development |
| \`economy\` | Haiku 4.5 | Haiku 4.5 | Haiku 4.5 | Sonnet quota draining, simple tasks |
| \`no-sonnet\` | **Opus 4.7** | Haiku 4.5 | **Opus 4.7** | Sonnet unavailable, critical decisions need Opus |

**Your role as a hub agent:**
- You work in a strategic-importance repo (hub) — therefore you have an elevated "thinking budget"
- If you see a task that needs a **more capable model** (architecture, critical refactor, complex ML) — suggest the user switch to \`no-sonnet\` (Opus for hub repos)
- If you see a task suitable for **economy mode** (routine docs, simple tweaks) — suggest \`economy\`
- Switch via: Bash \`claude-scaffold mode <name>\` or \`/mode-switch\` slash command
- After switching, remind the user to restart the current session`;
}

function buildQuotaWarningBlock(quotaCache, lang) {
  if (!quotaCache || !quotaCache.available) return null;
  const os = require("os");
  const fsMod = require("fs");
  let budget = { weekly_usd: 100, warn_threshold_pct: 80, block_threshold_pct: 95, currency: "usd" };
  try {
    const bp = path.join(os.homedir(), ".claude", "quota-budget.json");
    if (fsMod.existsSync(bp)) budget = { ...budget, ...JSON.parse(fsMod.readFileSync(bp, "utf8")) };
  } catch { /* defaults */ }
  if (budget.weekly_usd <= 0) return null;
  const pct = Math.round((quotaCache.weekly_usd / budget.weekly_usd) * 1000) / 10;
  if (pct < budget.warn_threshold_pct) return null;

  const severe = pct >= budget.block_threshold_pct;
  if (lang === "ru") {
    const hdr = severe ? "## [КВОТА ПОЧТИ ИСЧЕРПАНА]" : "## [ПРЕДУПРЕЖДЕНИЕ О КВОТЕ]";
    return `${hdr}
Недельная квота Claude Code: **${quotaCache.weekly_usd} / ${budget.weekly_usd} ${budget.currency.toUpperCase()} (${pct}%)**.
${severe
  ? "Порог блокировки превышен. Дальнейшие запросы могут идти как extra usage (платно сверх подписки)."
  : "Квота приближается к лимиту — рассмотри переключение в режим \`economy\`: \`claude-scaffold mode economy\`."}
Источник: ccusage (локальный анализ JSONL, approximate). Детали: \`claude-scaffold quota status\``;
  }
  const hdr = severe ? "## [QUOTA ALMOST EXHAUSTED]" : "## [QUOTA WARNING]";
  return `${hdr}
Weekly Claude Code usage: **${quotaCache.weekly_usd} / ${budget.weekly_usd} ${budget.currency.toUpperCase()} (${pct}%)**.
${severe
  ? "Block threshold exceeded. Further requests may count as extra usage (paid beyond subscription)."
  : "Usage approaching limit — consider switching to \`economy\` mode: \`claude-scaffold mode economy\`."}
Source: ccusage (local JSONL analysis, approximate). Details: \`claude-scaffold quota status\``;
}

function readQuotaCache() {
  try {
    const os = require("os");
    const p = path.join(os.homedir(), ".claude", "quota-cache.json");
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const TTL = 10 * 60 * 1000;
    if (Date.now() - raw.cached_at > TTL) return null;
    return raw;
  } catch { return null; }
}

function buildModelConflictBlockFallback(envModel, projectModel) {
  return `## [MODEL CONFLICT]\n` +
    `\`ANTHROPIC_MODEL=${envModel}\` in your shell overrides project model \`${projectModel}\` from .claude/settings.json.\n` +
    `To use the project model for this repo, unset the env var:\n` +
    `  unset ANTHROPIC_MODEL   # bash/zsh\n` +
    `  Remove-Item Env:ANTHROPIC_MODEL   # PowerShell\n` +
    `Then restart Claude Code.`;
}

function buildModelConflictAddition(settings, envModel, lang) {
  if (!settings || !settings.model || !envModel) return null;
  if (settings.model === envModel) return null;
  const i18n = resolveI18n();
  if (i18n && typeof i18n.buildModelConflictBlock === "function") {
    return i18n.buildModelConflictBlock(envModel, settings.model, lang);
  }
  return buildModelConflictBlockFallback(envModel, settings.model);
}

function buildCCRStatusBlock(settings, cwd, lang) {
  // Only check CCR for OpenRouter projects
  if (!settings || !settings.scaffold || settings.scaffold.provider !== 'openrouter') return null;

  const ccrUrl = process.env.ANTHROPIC_BASE_URL || 'http://127.0.0.1:3456';
  const isCCR = ccrUrl.includes('127.0.0.1') || ccrUrl.includes('localhost');

  if (!isCCR) return null; // Not using CCR

  // Try health check
  let ccrRunning = false;
  try {
    const http = require('http');
    const url = new URL(ccrUrl.replace(/\/api$/, '') + '/health');
    // Synchronous check via execSync (hook context)
    const { execSync } = require('child_process');
    const result = execSync(`curl -s -o /dev/null -w "%{http_code}" ${url.href} --connect-timeout 2 --max-time 2 2>/dev/null || echo "000"`, { encoding: 'utf8', timeout: 5000 });
    ccrRunning = result.trim() === '200';
  } catch {
    ccrRunning = false;
  }

  if (ccrRunning) return null; // CCR is running, no warning needed

  if (lang === 'ru') {
    return `## [CCR НЕ ЗАПУЩЕН]\nClaude Code Router не запущен. Запустите: \`ccr start\`\nЗатем перезапустите Claude Code.`;
  }
  return `## [CCR NOT RUNNING]\nClaude Code Router is not running. Start it with: \`ccr start\`\nThen restart Claude Code.`;
}

function main(inputStr, cwd, platform, detectPython) {
  let input = {};
  try {
    input = JSON.parse(inputStr);
  } catch {
    input = {};
  }

  const effectiveCwd = cwd || process.cwd();
  const effectivePlatform = platform || process.platform;
  const pythonCmd = detectPython ? detectPython() : detectPythonCmd(effectivePlatform);
  const shell = detectShell();

  const existing = loadConfig(effectiveCwd);
  const sessionCount = existing ? (existing.session_count || 0) + 1 : 1;

  const lang = (existing && existing.lang) || "en";

  const config = {
    platform: effectivePlatform,
    python_cmd: pythonCmd,
    shell,
    session_count: sessionCount,
    lang,
  };

  saveConfig(effectiveCwd, config);

  const envBlock = buildEnvBlock(effectivePlatform, pythonCmd, shell, sessionCount);
  const isFirstRun = !existing || (existing.session_count || 0) === 0;
  const blocks = buildLocalizedBlocks(lang);

  const additions = [envBlock];
  if (isFirstRun) additions.push(blocks.onboarding);
  if (effectivePlatform === "win32") additions.push(blocks.windows);
  if (sessionCount > 1 && sessionCount % 10 === 0) additions.push(COMMIT_RULES_REMINDER_BLOCK);
  const depsBlock = buildDepsBlock(fs, effectiveCwd);
  if (depsBlock) additions.push(depsBlock);
  const infraBlock = buildInfraBlock(fs, effectiveCwd);
  if (infraBlock) additions.push(infraBlock);
  const contractBlock = buildContractMissingBlock(fs, effectiveCwd, sessionCount);
  if (contractBlock) additions.push(contractBlock);
  const discoveryBlock = buildDiscoverySuggestionBlock(fs, effectiveCwd, sessionCount);
  if (discoveryBlock) additions.push(discoveryBlock);
  const settings = loadSettings(effectiveCwd, fs);
  const modelConflictBlock = buildModelConflictAddition(settings, process.env.ANTHROPIC_MODEL, lang);
  if (modelConflictBlock) additions.push(modelConflictBlock);

  const { entry: registryEntry, activeMode } = loadRegistryEntry(effectiveCwd, fs);
  const baseProfile = registryEntry && registryEntry.base_profile ? registryEntry.base_profile : null;
  const hubGuideBlock = buildHubModeGuideBlock(baseProfile, activeMode, lang);
  if (hubGuideBlock) additions.push(hubGuideBlock);

  const quotaCache = readQuotaCache();
  const quotaBlock = buildQuotaWarningBlock(quotaCache, lang);
  if (quotaBlock) additions.push(quotaBlock);

  // CCR health check for OpenRouter projects
  const ccrBlock = buildCCRStatusBlock(settings, effectiveCwd, lang);
  if (ccrBlock) additions.push(ccrBlock);

  if (process.env.SCAFFOLD_LIGHT_AGENTS === "true" || process.env.SCAFFOLD_LIGHT_AGENTS === "1") {
    additions.push(LIGHT_AGENTS_BLOCK);
  }

  return {
    continue: true,
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: additions.join("\n\n---\n\n") },
  };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd(), process.platform, null);
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main, buildEnvBlock, loadConfig, saveConfig, parseSimpleYaml, buildDepsBlock, buildInfraBlock, buildContractMissingBlock, buildDiscoverySuggestionBlock, loadSettings, loadRegistryEntry, buildModelConflictAddition, buildModelConflictBlockFallback, buildHubModeGuideBlock, buildQuotaWarningBlock, readQuotaCache, buildCCRStatusBlock, ONBOARDING_BLOCK, WINDOWS_RULES_BLOCK, COMMIT_RULES_REMINDER_BLOCK, buildLocalizedBlocks, LIGHT_AGENTS_BLOCK };
