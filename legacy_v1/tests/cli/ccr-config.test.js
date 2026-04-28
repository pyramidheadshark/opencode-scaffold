'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  OPENROUTER_MODELS,
  PROFILE_CCR_ROUTING,
  MODE_CCR_ROUTING,
  OPENROUTER_MODEL_PRESETS,
  generateCCRConfig,
  buildTransformerConfig,
  getCCRConfigPath,
  getCCRDir,
  getScaffoldModePath,
  getCCREnvVars,
  getScaffoldSettings,
} = require('../../lib/ccr-config');

describe('ccr-config — OPENROUTER_MODELS', () => {
  test('contains all required models', () => {
    const requiredModels = ['deepseek-v4-flash', 'glm-5.1', 'kimi-k2.6', 'sonnet-4.6', 'opus-4.7', 'haiku-4.5', 'gemini-2.5-pro', 'gemini-2.5-flash'];
    for (const key of requiredModels) {
      expect(OPENROUTER_MODELS[key]).toBeDefined();
      expect(OPENROUTER_MODELS[key].id).toBeTruthy();
      expect(OPENROUTER_MODELS[key].label).toBeTruthy();
      expect(Array.isArray(OPENROUTER_MODELS[key].transformers)).toBe(true);
    }
  });

  test('DeepSeek V4 Flash has correct ID', () => {
    expect(OPENROUTER_MODELS['deepseek-v4-flash'].id).toBe('deepseek/deepseek-v4-flash');
  });

  test('GLM 5.1 has correct ID', () => {
    expect(OPENROUTER_MODELS['glm-5.1'].id).toBe('z-ai/glm-5.1');
  });

  test('Kimi K2.6 has correct ID', () => {
    expect(OPENROUTER_MODELS['kimi-k2.6'].id).toBe('moonshotai/kimi-k2.6');
  });

  test('Anthropic models have no transformers', () => {
    expect(OPENROUTER_MODELS['sonnet-4.6'].transformers).toEqual([]);
    expect(OPENROUTER_MODELS['opus-4.7'].transformers).toEqual([]);
    expect(OPENROUTER_MODELS['haiku-4.5'].transformers).toEqual([]);
  });

  test('DeepSeek V4 Flash has tooluse + enhancetool', () => {
    expect(OPENROUTER_MODELS['deepseek-v4-flash'].transformers).toEqual(['tooluse', 'enhancetool']);
  });

  test('Kimi K2.6 has reasoning + enhancetool', () => {
    expect(OPENROUTER_MODELS['kimi-k2.6'].transformers).toEqual(['reasoning', 'enhancetool']);
  });
});

describe('ccr-config — PROFILE_CCR_ROUTING', () => {
  test('all 6 profiles have routing rules', () => {
    const profiles = ['ml-engineer', 'ai-developer', 'fastapi-developer', 'fullstack', 'hub', 'task-hub'];
    for (const profile of profiles) {
      expect(PROFILE_CCR_ROUTING[profile]).toBeDefined();
      expect(PROFILE_CCR_ROUTING[profile].default).toBeTruthy();
      expect(PROFILE_CCR_ROUTING[profile].background).toBeTruthy();
      expect(PROFILE_CCR_ROUTING[profile].think).toBeTruthy();
      expect(PROFILE_CCR_ROUTING[profile].longContext).toBeTruthy();
    }
  });

  test('hub profile uses GLM-5.1 as default', () => {
    expect(PROFILE_CCR_ROUTING['hub'].default).toBe('openrouter,z-ai/glm-5.1');
  });

  test('ai-developer profile uses DeepSeek V4 Flash as default', () => {
    expect(PROFILE_CCR_ROUTING['ai-developer'].default).toBe('openrouter,deepseek/deepseek-v4-flash');
  });

  test('all profiles use Kimi K2.6 for think', () => {
    for (const profile of Object.keys(PROFILE_CCR_ROUTING)) {
      expect(PROFILE_CCR_ROUTING[profile].think).toBe('openrouter,moonshotai/kimi-k2.6');
    }
  });

  test('all profiles use Gemini 2.5 Pro for longContext', () => {
    for (const profile of Object.keys(PROFILE_CCR_ROUTING)) {
      expect(PROFILE_CCR_ROUTING[profile].longContext).toBe('openrouter,google/gemini-2.5-pro');
    }
  });
});

describe('ccr-config — MODE_CCR_ROUTING', () => {
  test('default mode returns null (use profile routing)', () => {
    expect(MODE_CCR_ROUTING['default']).toBeNull();
  });

  test('economy mode uses DeepSeek V4 Flash everywhere', () => {
    const economy = MODE_CCR_ROUTING['economy'];
    expect(economy.default).toBe('openrouter,deepseek/deepseek-v4-flash');
    expect(economy.background).toBe('openrouter,deepseek/deepseek-v4-flash');
    expect(economy.think).toBe('openrouter,deepseek/deepseek-v4-flash');
  });

  test('reasoning mode uses Kimi K2.6 as default', () => {
    expect(MODE_CCR_ROUTING['reasoning'].default).toBe('openrouter,moonshotai/kimi-k2.6');
  });

  test('openrouter-full mode has webSearch', () => {
    expect(MODE_CCR_ROUTING['openrouter-full'].webSearch).toBe('openrouter,google/gemini-2.5-flash');
  });
});

describe('ccr-config — OPENROUTER_MODEL_PRESETS', () => {
  test('contains all expected presets', () => {
    const expectedPresets = ['deepseek', 'glm', 'glm-flash', 'kimi', 'sonnet', 'opus', 'haiku', 'gemini', 'gemini-flash', 'mixed'];
    for (const preset of expectedPresets) {
      expect(OPENROUTER_MODEL_PRESETS[preset]).toBeDefined();
    }
  });

  test('deepseek preset maps to DeepSeek V4 Flash', () => {
    expect(OPENROUTER_MODEL_PRESETS['deepseek'].model).toBe('deepseek/deepseek-v4-flash');
  });

  test('glm preset maps to GLM 5.1', () => {
    expect(OPENROUTER_MODEL_PRESETS['glm'].model).toBe('z-ai/glm-5.1');
  });

  test('kimi preset maps to Kimi K2.6', () => {
    expect(OPENROUTER_MODEL_PRESETS['kimi'].model).toBe('moonshotai/kimi-k2.6');
  });

  test('mixed preset has isMixed flag', () => {
    expect(OPENROUTER_MODEL_PRESETS['mixed'].isMixed).toBe(true);
  });
});

describe('ccr-config — generateCCRConfig', () => {
  test('generates valid config for ai-developer profile', () => {
    const config = generateCCRConfig('ai-developer');
    expect(config.Providers).toBeDefined();
    expect(config.Providers[0].name).toBe('openrouter');
    expect(config.Providers[0].api_base_url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(config.Providers[0].models.length).toBeGreaterThan(0);
    expect(config.Router.default).toBe('openrouter,deepseek/deepseek-v4-flash');
    expect(config.Router.think).toBe('openrouter,moonshotai/kimi-k2.6');
    expect(config.API_TIMEOUT_MS).toBe(600000);
  });

  test('generates valid config for hub profile', () => {
    const config = generateCCRConfig('hub');
    expect(config.Router.default).toBe('openrouter,z-ai/glm-5.1');
  });

  test('uses custom API key when provided', () => {
    const config = generateCCRConfig('ai-developer', { apiKey: 'sk-test-key' });
    expect(config.Providers[0].api_key).toBe('sk-test-key');
  });

  test('default API key is $OPENROUTER_API_KEY', () => {
    const config = generateCCRConfig('ai-developer');
    expect(config.Providers[0].api_key).toBe('$OPENROUTER_API_KEY');
  });

  test('includes custom router path', () => {
    const config = generateCCRConfig('ai-developer');
    expect(config.CUSTOM_ROUTER_PATH).toContain('custom-router.js');
  });
});

describe('ccr-config — buildTransformerConfig', () => {
  test('includes openrouter base transformer', () => {
    const config = buildTransformerConfig();
    expect(config.use).toContain('openrouter');
  });

  test('DeepSeek V4 Flash has tooluse + enhancetool', () => {
    const config = buildTransformerConfig();
    expect(config['deepseek/deepseek-v4-flash'].use).toEqual(['tooluse', 'enhancetool']);
  });

  test('Kimi K2.6 has reasoning + enhancetool', () => {
    const config = buildTransformerConfig();
    expect(config['moonshotai/kimi-k2.6'].use).toEqual(['reasoning', 'enhancetool']);
  });

  test('Anthropic models have no transformers', () => {
    const config = buildTransformerConfig();
    expect(config['anthropic/claude-sonnet-4.6']).toBeUndefined();
    expect(config['anthropic/claude-opus-4.7']).toBeUndefined();
  });
});

describe('ccr-config — getCCREnvVars', () => {
  test('returns correct CCR env vars', () => {
    const envVars = getCCREnvVars();
    expect(envVars.CLAUDE_CODE_DISABLE_1M_CONTEXT).toBe('1');
    expect(envVars.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS).toBe('1');
    expect(envVars.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:3456');
    expect(envVars.ANTHROPIC_AUTH_TOKEN).toBe('$OPENROUTER_API_KEY');
    expect(envVars.ANTHROPIC_API_KEY).toBe('');
  });

  test('ANTHROPIC_API_KEY is empty string not null', () => {
    const envVars = getCCREnvVars();
    expect(envVars.ANTHROPIC_API_KEY).toBe('');
    expect(envVars.ANTHROPIC_API_KEY).not.toBeNull();
    expect(envVars.ANTHROPIC_API_KEY).not.toBeUndefined();
  });
});

describe('ccr-config — getScaffoldSettings', () => {
  test('returns correct scaffold settings for openrouter', () => {
    const settings = getScaffoldSettings('ml-engineer');
    expect(settings.provider).toBe('openrouter');
    expect(settings.profile).toBe('ml-engineer');
    expect(settings.mode).toBe('default');
    expect(settings.ccrEnabled).toBe(true);
  });

  test('defaults to ai-developer profile', () => {
    const settings = getScaffoldSettings();
    expect(settings.profile).toBe('ai-developer');
  });
});

describe('ccr-config — paths', () => {
  test('getCCRDir returns correct path', () => {
    expect(getCCRDir()).toBe(path.join(os.homedir(), '.claude-code-router'));
  });

  test('getCCRConfigPath returns correct path', () => {
    expect(getCCRConfigPath()).toBe(path.join(os.homedir(), '.claude-code-router', 'config.json'));
  });

  test('getScaffoldModePath returns correct path', () => {
    expect(getScaffoldModePath()).toBe(path.join(os.homedir(), '.claude', 'scaffold-mode'));
  });
});