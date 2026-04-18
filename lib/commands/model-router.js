'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

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
    model: 'claude-opus-4-6',
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

function use(modelOrPreset, opts = {}) {
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
};
