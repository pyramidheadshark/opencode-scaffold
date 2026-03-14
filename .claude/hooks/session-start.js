#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CONFIG_FILE = ".claude/project-config.json";

function resolveI18n() {
  try {
    const i18nPath = path.join(__dirname, "..", "..", "lib", "i18n.js");
    if (fs.existsSync(i18nPath)) return require(i18nPath);
  } catch {}
  return null;
}

function detectPythonCmd(plat) {
  if ((plat || process.platform) === "win32") return "python";
  try {
    execSync("python3 --version", { stdio: "ignore" });
    return "python3";
  } catch {
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
  } catch {
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

  return {
    continue: true,
    system_prompt_addition: additions.join("\n\n---\n\n"),
  };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd(), process.platform, null);
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main, buildEnvBlock, loadConfig, saveConfig, ONBOARDING_BLOCK, WINDOWS_RULES_BLOCK, buildLocalizedBlocks };
