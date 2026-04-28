'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const ccr = require('../ccr-config');

// ── Legacy Anthropic Profiles (kept for backward compat) ──────────────

const PROFILES = {
  sonnet: {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
  haiku: {
    model: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
  opus: {
    model: 'claude-opus-4-7',
    provider: 'anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
  'gemini-flash': {
    model: 'google/gemini-3-flash-preview',
    provider: 'openrouter',
    keyEnv: 'OPENROUTER_API_KEY',
    experimental: true,
  },
  'gemini-pro': {
    model: 'google/gemini-3-pro',
    provider: 'openrouter',
    keyEnv: 'OPENROUTER_API_KEY',
    experimental: true,
  },
};

const PRESETS = {
  executor: 'gemini-flash',
  architect: 'opus',
  critic: 'sonnet',
};

function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

function getConfigPath() {
  return path.join(getClaudeDir(), 'model-config.json');
}

const ALIAS_START = '# === claude-scaffold model aliases [start] ===';
const ALIAS_END = '# === claude-scaffold model aliases [end] ===';

function resolveProfile(modelOrPreset) {
  if (PRESETS[modelOrPreset]) return PRESETS[modelOrPreset];
  return modelOrPreset;
}

// ── CCR-aware model switching ─────────────────────────────────────────

function isCCRConfigured() {
  return fs.existsSync(ccr.getCCRConfigPath());
}

function useCCRModel(presetName, opts = {}) {
  const preset = ccr.OPENROUTER_MODEL_PRESETS[presetName];
  if (!preset) {
    const available = Object.keys(ccr.OPENROUTER_MODEL_PRESETS).join(', ');
    throw new Error(`Unknown model preset: "${presetName}". Available: ${available}`);
  }

  // Session mode — output /model command
  if (opts.session) {
    if (preset.isMixed) {
      console.log('Mixed mode requires CCR restart. Run without --session flag.');
      return;
    }
    console.log(`/model openrouter,${preset.model}`);
    return;
  }

  // Check CCR config exists
  if (!isCCRConfigured()) {
    throw new Error('CCR config not found. Run: claude-scaffold init --provider openrouter or claude-scaffold ccr-setup');
  }

  // Update CCR Router
  const newRouter = {};
  if (preset.isMixed) {
    newRouter.default = 'openrouter,deepseek/deepseek-v4-flash';
    newRouter.background = 'openrouter,z-ai/glm-5.1';
    newRouter.think = 'openrouter,moonshotai/kimi-k2.6';
  } else {
    newRouter.default = `openrouter,${preset.model}`;
  }

  if (!ccr.updateCCRRouter(newRouter)) {
    throw new Error('Failed to update CCR config.');
  }

  // Save scaffold mode
  ccr.writeScaffoldMode(presetName === 'mixed' ? 'mixed' : 'custom');

  // Restart CCR
  console.log(`✅ Model set to ${preset.description || preset.label}`);
  ccr.restartCCR().then(success => {
    if (!success) {
      console.log('⚠️  CCR not restarted. Run manually: ccr restart');
    }
  });
}

function showModelStatus() {
  // Try CCR config first
  const ccrConfig = ccr.readCCRConfig();
  if (ccrConfig) {
    const router = ccrConfig.Router || {};
    console.log('\n  CCR Router Status:');
    console.log(`    default:       ${router.default || '(not set)'}`);
    console.log(`    background:    ${router.background || '(not set)'}`);
    console.log(`    think:         ${router.think || '(not set)'}`);
    console.log(`    longContext:   ${router.longContext || '(not set)'}`);
    if (router.webSearch) {
      console.log(`    webSearch:     ${router.webSearch}`);
    }
    const mode = ccr.readScaffoldMode();
    console.log(`    scaffold mode: ${mode}`);
    console.log();
    return;
  }

  // Fallback to legacy model-config.json
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    const config = JSON.parse(raw);
    console.log(`\n  Active model: ${config.profile} (${config.model} via ${config.provider})`);
    console.log(`  Updated: ${config.updatedAt}`);
    console.log();
  } catch {
    console.log('\n  No model configuration found.');
    console.log('  Run: claude-scaffold use <model>');
    console.log();
  }
}

// ── Legacy env-var based switching ────────────────────────────────────

function buildShEnvContent(profileName, profile) {
  if (profile.provider === 'openrouter') {
    return [
      `export ANTHROPIC_BASE_URL="https://openrouter.ai/api"`,
      'export ANTHROPIC_AUTH_TOKEN="${OPENROUTER_API_KEY}"',
      `export ANTHROPIC_API_KEY=""`,
      `export SCAFFOLD_ACTIVE_MODEL="${profile.model}"`,
      '',
    ].join('\n');
  }
  return [
    `unset ANTHROPIC_BASE_URL`,
    `unset ANTHROPIC_AUTH_TOKEN`,
    `export SCAFFOLD_ACTIVE_MODEL="${profile.model}"`,
    '',
  ].join('\n');
}

function buildPs1EnvContent(profileName, profile) {
  if (profile.provider === 'openrouter') {
    return [
      `$env:ANTHROPIC_BASE_URL = "https://openrouter.ai/api"`,
      `$env:ANTHROPIC_AUTH_TOKEN = $env:OPENROUTER_API_KEY`,
      `$env:ANTHROPIC_API_KEY = ""`,
      `$env:SCAFFOLD_ACTIVE_MODEL = "${profile.model}"`,
      '',
    ].join('\n');
  }
  return [
    `Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue`,
    `Remove-Item Env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue`,
    `$env:SCAFFOLD_ACTIVE_MODEL = "${profile.model}"`,
    '',
  ].join('\n');
}

function useLegacy(modelOrPreset, opts = {}) {
  const profileName = resolveProfile(modelOrPreset);

  if (!PROFILES[profileName]) {
    const available = [
      ...Object.keys(PROFILES),
      ...Object.keys(PRESETS).map(p => `${p} (→ ${PRESETS[p]})`),
    ].join(', ');
    console.error(`Unknown model or preset: "${modelOrPreset}"`);
    console.error(`Available: ${available}`);
    process.exit(1);
  }

  const profile = PROFILES[profileName];

  if (opts.showEnv) {
    console.log(buildShEnvContent(profileName, profile));
    return;
  }

  const claudeDir = getClaudeDir();
  const configPath = getConfigPath();
  fs.mkdirSync(claudeDir, { recursive: true });

  const config = {
    profile: profileName,
    model: profile.model,
    provider: profile.provider,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

  const shContent = buildShEnvContent(profileName, profile).replace(/\r\n/g, '\n');
  const shPath = path.join(claudeDir, `scaffold-env-${profileName}.sh`);
  fs.writeFileSync(shPath, shContent, 'utf8');

  if (os.platform() === 'win32' || profile.provider === 'openrouter') {
    const ps1Content = buildPs1EnvContent(profileName, profile).replace(/\r\n/g, '\n');
    const ps1Path = path.join(claudeDir, `scaffold-env-${profileName}.ps1`);
    fs.writeFileSync(ps1Path, ps1Content, 'utf8');
  }

  console.log(`Active model: ${profileName} (${profile.model} via ${profile.provider})`);

  if (profile.experimental) {
    console.log(`⚠ Experimental: tool_use / thinking / cache compatibility not guaranteed.`);
  }

  if (profile.provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      console.log(`⚠ OPENROUTER_API_KEY not set. Set it before using.`);
    }
    const existingKey = process.env.ANTHROPIC_API_KEY || '';
    if (existingKey.startsWith('sk-ant')) {
      console.log(`⚠ Anthropic key will be overridden for OpenRouter sessions.`);
    }
  }

  console.log(`\nTo start Claude Code with this model:`);
  console.log(`  source ${shPath} && claude --model ${profile.model}`);

  if (profile.provider === 'openrouter') {
    const ps1Path = path.join(claudeDir, `scaffold-env-${profileName}.ps1`);
    console.log(`\nOn Windows PowerShell:`);
    console.log(`  . ${ps1Path}; claude --model ${profile.model}`);
  }

  console.log(`\nOr if aliases installed:`);
  console.log(`  claude-${profileName}`);
  console.log(`\nConfig saved to: ${configPath}`);
}

// ── Main use() function ───────────────────────────────────────────────

function use(modelOrPreset, opts = {}) {
  // If CCR is configured, use CCR model switching
  if (isCCRConfigured()) {
    if (ccr.OPENROUTER_MODEL_PRESETS[modelOrPreset]) {
      useCCRModel(modelOrPreset, opts);
      return;
    }
    // Unknown model when CCR is configured
    if (!PROFILES[resolveProfile(modelOrPreset)]) {
      console.error(`Unknown model: "${modelOrPreset}"`);
      console.error(`OpenRouter presets: ${Object.keys(ccr.OPENROUTER_MODEL_PRESETS).join(', ')}`);
      console.error(`Legacy profiles: ${Object.keys(PROFILES).join(', ')}`);
      process.exit(1);
    }
  }

  // Fallback to legacy (no CCR, or known legacy profile)
  useLegacy(modelOrPreset, opts);
}

function buildAliasBlock() {
  const lines = Object.keys(PROFILES).map(
    name =>
      `alias claude-${name}='source ~/.claude/scaffold-env-${name}.sh && claude'`
  );
  return `${ALIAS_START}\n${lines.join('\n')}\n${ALIAS_END}`;
}

function installAliases() {
  const bashrcPath = path.join(os.homedir(), '.bashrc');
  const block = buildAliasBlock();
  const markerRegex = new RegExp(
    `${ALIAS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${ALIAS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );

  let content = '';
  if (fs.existsSync(bashrcPath)) {
    content = fs.readFileSync(bashrcPath, 'utf8').replace(/\r\n/g, '\n');
  }

  if (markerRegex.test(content)) {
    content = content.replace(markerRegex, block);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) {
      content += '\n';
    }
    content += '\n' + block + '\n';
  }

  fs.writeFileSync(bashrcPath, content, 'utf8');
  console.log(`Aliases installed in ${bashrcPath}`);
  console.log('Run: source ~/.bashrc');
}

function getActiveProfile() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = {
  PROFILES,
  PRESETS,
  getConfigPath,
  ALIAS_START,
  ALIAS_END,
  use,
  installAliases,
  getActiveProfile,
  buildAliasBlock,
  showModelStatus,
  useCCRModel,
  isCCRConfigured,
};