'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── OpenRouter Model IDs ──────────────────────────────────────────────

const OPENROUTER_MODELS = Object.freeze({
  'deepseek-v4-flash':   { id: 'deepseek/deepseek-v4-flash',        label: 'DeepSeek V4 Flash',  emoji: '🟠', transformers: ['tooluse', 'enhancetool'] },
  'glm-5.1':             { id: 'z-ai/glm-5.1',                      label: 'GLM 5.1',            emoji: '🔵', transformers: ['enhancetool'] },
  'glm-4.7-flash':       { id: 'z-ai/glm-4.7-flash',                label: 'GLM 4.7 Flash',      emoji: '🔹', transformers: ['enhancetool'] },
  'kimi-k2.6':           { id: 'moonshotai/kimi-k2.6',               label: 'Kimi K2.6',          emoji: '🌙', transformers: ['reasoning', 'enhancetool'] },
  'sonnet-4.6':          { id: 'anthropic/claude-sonnet-4.6',         label: 'Sonnet 4.6',        emoji: '🟣', transformers: [] },
  'opus-4.7':            { id: 'anthropic/claude-opus-4.7',           label: 'Opus 4.7',          emoji: '💜', transformers: [] },
  'haiku-4.5':           { id: 'anthropic/claude-haiku-4.5',          label: 'Haiku 4.5',         emoji: '🟢', transformers: [] },
  'gemini-2.5-pro':      { id: 'google/gemini-2.5-pro',              label: 'Gemini 2.5 Pro',     emoji: '🔷', transformers: ['enhancetool'] },
  'gemini-2.5-flash':    { id: 'google/gemini-2.5-flash',            label: 'Gemini 2.5 Flash',   emoji: '🔹', transformers: ['enhancetool'] },
});

// ── Profile → CCR Router Rules ────────────────────────────────────────

const PROFILE_CCR_ROUTING = Object.freeze({
  'ml-engineer': Object.freeze({
    default: 'openrouter,deepseek/deepseek-v4-flash',
    background: 'openrouter,deepseek/deepseek-chat',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
    longContextThreshold: 60000,
  }),
  'ai-developer': Object.freeze({
    default: 'openrouter,deepseek/deepseek-v4-flash',
    background: 'openrouter,deepseek/deepseek-chat',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
    longContextThreshold: 60000,
  }),
  'fastapi-developer': Object.freeze({
    default: 'openrouter,deepseek/deepseek-v4-flash',
    background: 'openrouter,z-ai/glm-5.1',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
    longContextThreshold: 60000,
  }),
  'fullstack': Object.freeze({
    default: 'openrouter,deepseek/deepseek-v4-flash',
    background: 'openrouter,z-ai/glm-5.1',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
    longContextThreshold: 60000,
  }),
  'hub': Object.freeze({
    default: 'openrouter,z-ai/glm-5.1',
    background: 'openrouter,deepseek/deepseek-v4-flash',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
    longContextThreshold: 60000,
  }),
  'task-hub': Object.freeze({
    default: 'openrouter,deepseek/deepseek-v4-flash',
    background: 'openrouter,deepseek/deepseek-chat',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
    longContextThreshold: 60000,
  }),
});

// ── Mode → CCR Router overrides ───────────────────────────────────────

const MODE_CCR_ROUTING = Object.freeze({
  'default': null, // use profile routing (no override)
  'economy': Object.freeze({
    default: 'openrouter,deepseek/deepseek-v4-flash',
    background: 'openrouter,deepseek/deepseek-v4-flash',
    think: 'openrouter,deepseek/deepseek-v4-flash',
    longContext: 'openrouter,deepseek/deepseek-v4-flash',
  }),
  'no-sonnet': Object.freeze({
    default: 'openrouter,z-ai/glm-5.1',
    background: 'openrouter,deepseek/deepseek-v4-flash',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
  }),
  'reasoning': Object.freeze({
    default: 'openrouter,moonshotai/kimi-k2.6',
    background: 'openrouter,deepseek/deepseek-v4-flash',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
  }),
  'openrouter-full': Object.freeze({
    default: 'openrouter,deepseek/deepseek-v4-flash',
    background: 'openrouter,deepseek/deepseek-v4-flash',
    think: 'openrouter,moonshotai/kimi-k2.6',
    longContext: 'openrouter,google/gemini-2.5-pro',
    webSearch: 'openrouter,google/gemini-2.5-flash',
  }),
});

// ── Model Presets for `use` command ───────────────────────────────────

const OPENROUTER_MODEL_PRESETS = Object.freeze({
  'deepseek':       { model: 'deepseek/deepseek-v4-flash',        label: 'DeepSeek V4 Flash',  description: 'DeepSeek V4 Flash — быстрая кодинговая модель' },
  'glm':            { model: 'z-ai/glm-5.1',                      label: 'GLM 5.1',            description: 'GLM 5.1 — качественная модель от Z.ai' },
  'glm-flash':      { model: 'z-ai/glm-4.7-flash',                label: 'GLM 4.7 Flash',      description: 'GLM 4.7 Flash — быстрая модель от Z.ai' },
  'kimi':           { model: 'moonshotai/kimi-k2.6',               label: 'Kimi K2.6',          description: 'Kimi K2.6 — reasoning модель от Moonshot AI' },
  'sonnet':         { model: 'anthropic/claude-sonnet-4.6',         label: 'Sonnet 4.6',        description: 'Claude Sonnet 4.6 через OpenRouter' },
  'opus':           { model: 'anthropic/claude-opus-4.7',           label: 'Opus 4.7',          description: 'Claude Opus 4.7 через OpenRouter' },
  'haiku':          { model: 'anthropic/claude-haiku-4.5',          label: 'Haiku 4.5',         description: 'Claude Haiku 4.5 через OpenRouter' },
  'gemini':         { model: 'google/gemini-2.5-pro',              label: 'Gemini 2.5 Pro',     description: 'Gemini 2.5 Pro — длинный контекст' },
  'gemini-flash':   { model: 'google/gemini-2.5-flash',            label: 'Gemini 2.5 Flash',   description: 'Gemini 2.5 Flash — быстрая мультимодальная' },
  'mixed':          { label: 'Mixed', description: 'Hybrid: DeepSeek V4 Flash default + Kimi K2.6 think + GLM 5.1 background', isMixed: true },
});

// ── CCR Config Path ───────────────────────────────────────────────────

function getCCRDir() {
  return path.join(os.homedir(), '.claude-code-router');
}

function getCCRConfigPath() {
  return path.join(getCCRDir(), 'config.json');
}

function getScaffoldModePath() {
  return path.join(os.homedir(), '.claude', 'scaffold-mode');
}

// ── Transformer Config Generation ─────────────────────────────────────

function buildTransformerConfig() {
  const transformer = { use: ['openrouter'] };
  for (const [key, model] of Object.entries(OPENROUTER_MODELS)) {
    if (model.transformers.length > 0) {
      transformer[model.id] = { use: model.transformers };
    }
  }
  return transformer;
}

// ── Generate Full CCR Config ──────────────────────────────────────────

function generateCCRConfig(profile, options = {}) {
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY || '$OPENROUTER_API_KEY';
  const routing = PROFILE_CCR_ROUTING[profile] || PROFILE_CCR_ROUTING['ai-developer'];

  return {
    APIKEY: options.ccrApiKey || '',
    LOG: options.log !== false,
    LOG_LEVEL: options.logLevel || 'info',
    API_TIMEOUT_MS: options.timeout || 600000,
    NON_INTERACTIVE_MODE: false,
    CUSTOM_ROUTER_PATH: options.customRouterPath || '~/.claude-code-router/custom-router.js',

    Providers: [
      {
        name: 'openrouter',
        api_base_url: 'https://openrouter.ai/api/v1/chat/completions',
        api_key: apiKey,
        models: Object.values(OPENROUTER_MODELS).map(m => m.id),
        transformer: buildTransformerConfig(),
      },
    ],

    Router: { ...routing },
  };
}

// ── Read / Write CCR Config ───────────────────────────────────────────

function readCCRConfig() {
  const configPath = getCCRConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeCCRConfig(config) {
  const configPath = getCCRConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return configPath;
}

// ── Update Router Section ─────────────────────────────────────────────

function updateCCRRouter(newRouter) {
  const config = readCCRConfig();
  if (!config) return false;
  config.Router = { ...config.Router, ...newRouter };
  writeCCRConfig(config);
  return true;
}

// ── Scaffold Mode Persistence ─────────────────────────────────────────

function readScaffoldMode() {
  try {
    return fs.readFileSync(getScaffoldModePath(), 'utf8').trim() || 'default';
  } catch {
    return 'default';
  }
}

function writeScaffoldMode(mode) {
  const modePath = getScaffoldModePath();
  fs.mkdirSync(path.dirname(modePath), { recursive: true });
  fs.writeFileSync(modePath, mode, 'utf8');
}

// ── CCR Process Management ────────────────────────────────────────────

function checkCCRInstalled() {
  try {
    const result = execSync('ccr --version', { stdio: 'pipe', encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function installCCR() {
  console.log('Installing Claude Code Router...');
  try {
    execSync('npm install -g @musistudio/claude-code-router', { stdio: 'inherit', timeout: 120000 });
    console.log('✅ CCR installed successfully.');
    return true;
  } catch (e) {
    console.error(`Failed to install CCR: ${e.message}`);
    console.error('Install manually: npm install -g @musistudio/claude-code-router');
    return false;
  }
}

async function getCCRStatus() {
  try {
    const result = execSync('ccr status', { stdio: 'pipe', encoding: 'utf8', timeout: 5000 });
    const running = result.includes('Running') || result.includes('✅');
    const pidMatch = result.match(/Process ID:\s*(\d+)/);
    const portMatch = result.match(/Port:\s*(\d+)/);
    return {
      running,
      pid: pidMatch ? parseInt(pidMatch[1]) : null,
      port: portMatch ? parseInt(portMatch[1]) : 3456,
      raw: result.trim(),
    };
  } catch {
    return { running: false, pid: null, port: 3456, raw: '' };
  }
}

async function restartCCR() {
  const status = await getCCRStatus();
  try {
    if (status.running) {
      execSync('ccr restart', { stdio: 'pipe', timeout: 15000 });
    } else {
      execSync('ccr start', { stdio: 'pipe', timeout: 15000 });
    }
    return true;
  } catch (e) {
    console.error(`Failed to restart CCR: ${e.message}`);
    console.error('Try manually: ccr restart (or ccr start)');
    return false;
  }
}

// ── Deploy CCR Config + Custom Router ─────────────────────────────────

function deployCCRConfig(profile, options = {}) {
  const configPath = getCCRConfigPath();

  // Don't overwrite existing config without --force
  if (fs.existsSync(configPath) && !options.force) {
    console.log(`ℹ️  CCR config already exists at ${configPath}. Use --force to overwrite.`);
    return false;
  }

  const config = generateCCRConfig(profile, options);
  writeCCRConfig(config);
  console.log(`✅ CCR config created at ${configPath}`);
  return true;
}

function deployCustomRouter(options = {}) {
  const routerPath = path.join(getCCRDir(), 'custom-router.js');

  if (fs.existsSync(routerPath) && !options.force) {
    console.log(`ℹ️  Custom router already exists at ${routerPath}. Use --force to overwrite.`);
    return false;
  }

  const customRouterCode = generateCustomRouterCode();
  fs.mkdirSync(path.dirname(routerPath), { recursive: true });
  fs.writeFileSync(routerPath, customRouterCode, 'utf8');
  console.log(`✅ Custom router created at ${routerPath}`);
  return true;
}

function deployCCRPreset(profile, options = {}) {
  const presetDir = path.join(getCCRDir(), 'presets', 'claude-scaffold');
  const manifestPath = path.join(presetDir, 'manifest.json');

  if (fs.existsSync(manifestPath) && !options.force) {
    console.log(`ℹ️  CCR preset already exists. Use --force to overwrite.`);
    return false;
  }

  const manifest = generateCCRPresetManifest(profile);
  fs.mkdirSync(presetDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✅ CCR preset created at ${manifestPath}`);
  return true;
}

// ── Custom Router Code Generator ──────────────────────────────────────

function generateCustomRouterCode() {
  return `'use strict';
// claude-scaffold custom router for CCR
// Routes requests based on scaffold mode and query content

const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async function router(req, config) {
  // 1. Read scaffold mode
  let scaffoldMode = 'default';
  try {
    scaffoldMode = fs.readFileSync(
      path.join(os.homedir(), '.claude', 'scaffold-mode'), 'utf8'
    ).trim();
  } catch {}

  // 2. Read last user message
  const messages = req.body?.messages || [];
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  const lastUserStr = typeof lastUserMsg?.content === 'string'
    ? lastUserMsg.content
    : JSON.stringify(lastUserMsg?.content || '');

  // 3. Contextual routing

  // Reasoning / analysis → think
  const thinkKw = ['analyze', 'reason', 'explain', 'plan', 'design',
                   'архитектур', 'анализ', 'планиров', 'объясн', 'проект',
                   'breakdown', 'compare', 'evaluate', 'assess'];
  if (thinkKw.some(kw => lastUserStr.toLowerCase().includes(kw))
      && lastUserStr.length > 200) {
    return config.Router?.think || null;
  }

  // Short / simple queries → background
  if (lastUserStr.length < 80 && !lastUserStr.includes('tool')) {
    return config.Router?.background || null;
  }

  // 4. Fallback — CCR handles routing by its own rules
  return null;
};
`;
}

// ── CCR Preset Manifest Generator ─────────────────────────────────────

function generateCCRPresetManifest(profile) {
  const routing = PROFILE_CCR_ROUTING[profile] || PROFILE_CCR_ROUTING['ai-developer'];
  return {
    name: 'claude-scaffold',
    version: '1.0.0',
    description: 'OpenRouter configuration for claude-scaffold (DeepSeek, GLM, Kimi, Claude)',
    author: 'claude-scaffold',
    keywords: ['openrouter', 'deepseek', 'glm', 'kimi', 'claude'],
    schema: [
      {
        id: 'openrouterApiKey',
        type: 'password',
        label: 'OpenRouter API Key',
        prompt: 'Enter your OpenRouter API key (sk-or-v1-...)',
      },
    ],
    Providers: [
      {
        name: 'openrouter',
        api_base_url: 'https://openrouter.ai/api/v1/chat/completions',
        api_key: '{{openrouterApiKey}}',
        models: Object.values(OPENROUTER_MODELS).map(m => m.id),
        transformer: buildTransformerConfig(),
      },
    ],
    Router: { ...routing },
  };
}

// ── CCR Settings for .claude/settings.json ────────────────────────────

function getCCREnvVars() {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  return {
    CLAUDE_CODE_DISABLE_1M_CONTEXT: '1',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:3456',
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_API_KEY: '',
  };
}

function getScaffoldSettings(profile, options = {}) {
  return {
    provider: 'openrouter',
    profile: profile || 'ai-developer',
    mode: 'default',
    ccrEnabled: true,
  };
}

// ── Module Exports ────────────────────────────────────────────────────

module.exports = {
  OPENROUTER_MODELS,
  PROFILE_CCR_ROUTING,
  MODE_CCR_ROUTING,
  OPENROUTER_MODEL_PRESETS,
  getCCRDir,
  getCCRConfigPath,
  getScaffoldModePath,
  generateCCRConfig,
  readCCRConfig,
  writeCCRConfig,
  updateCCRRouter,
  readScaffoldMode,
  writeScaffoldMode,
  checkCCRInstalled,
  installCCR,
  getCCRStatus,
  restartCCR,
  deployCCRConfig,
  deployCustomRouter,
  deployCCRPreset,
  generateCustomRouterCode,
  generateCCRPresetManifest,
  getCCREnvVars,
  getScaffoldSettings,
  buildTransformerConfig,
};