'use strict';

const MODEL_IDS = Object.freeze({
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
  opus:   'claude-opus-4-7',
});

const MODEL_LABELS = Object.freeze({
  'claude-sonnet-4-6':          'Sonnet 4.6',
  'claude-haiku-4-5-20251001':  'Haiku 4.5',
  'claude-opus-4-7':            'Opus 4.7',
  // OpenRouter models
  'deepseek/deepseek-v4-flash':  'DeepSeek V4 Flash',
  'z-ai/glm-5.1':                'GLM 5.1',
  'z-ai/glm-4.7-flash':          'GLM 4.7 Flash',
  'moonshotai/kimi-k2.6':        'Kimi K2.6',
  'anthropic/claude-sonnet-4.6':  'Sonnet 4.6 (OR)',
  'anthropic/claude-opus-4.7':    'Opus 4.7 (OR)',
  'anthropic/claude-haiku-4.5':   'Haiku 4.5 (OR)',
  'google/gemini-2.5-pro':        'Gemini 2.5 Pro',
  'google/gemini-2.5-flash':      'Gemini 2.5 Flash',
});

const MODEL_EMOJI = Object.freeze({
  sonnet: '🔵',
  haiku:  '🟢',
  opus:   '🟣',
  deepseek: '🟠',
  glm:    '🔷',
  kimi:   '🌙',
  gemini: '💠',
});

const VALID_PROFILES = Object.freeze(['power', 'standard', 'balanced']);
const VALID_MODES    = Object.freeze(['default', 'economy', 'no-sonnet', 'reasoning', 'openrouter-full']);

const PROFILE_MATRIX = Object.freeze({
  power:    Object.freeze({ default: 'sonnet', economy: 'haiku', 'no-sonnet': 'opus'  }),
  standard: Object.freeze({ default: 'haiku',  economy: 'haiku', 'no-sonnet': 'haiku' }),
  balanced: Object.freeze({ default: 'haiku',  economy: 'haiku', 'no-sonnet': 'opus'  }),
});

const DEPRECATED_MODES = Object.freeze({
  lean:         'economy',
  'quota-save': 'no-sonnet',
});

const DEPRECATED_ROLES = Object.freeze({
  hub:     'power',
  worker:  'balanced',
  default: 'balanced',
});

function normalizeMode(modeName) {
  if (DEPRECATED_MODES[modeName]) return DEPRECATED_MODES[modeName];
  return modeName;
}

function normalizeProfile(profileOrRole) {
  if (!profileOrRole) return 'balanced';
  if (VALID_PROFILES.includes(profileOrRole)) return profileOrRole;
  if (DEPRECATED_ROLES[profileOrRole]) return DEPRECATED_ROLES[profileOrRole];
  return 'balanced';
}

function resolveProfile(modeName, baseProfile) {
  const mode = normalizeMode(modeName);
  const profile = normalizeProfile(baseProfile);
  const matrix = PROFILE_MATRIX[profile];
  if (!matrix) return null;
  return matrix[mode] || matrix.default;
}

function autoDetectProfile(repoPath) {
  if (!repoPath) return 'balanced';
  const name = require('path').basename(repoPath).toLowerCase();
  if (name === 'techcon_hub' || name === 'rgs_hub' ||
      name === 'claude-scaffold' || name === 'dumpster') {
    return 'power';
  }
  if (name.startsWith('techcon_')) {
    return 'standard';
  }
  return 'balanced';
}

function shortNameFromModelId(modelId) {
  if (!modelId) return '';
  // Anthropic native IDs
  if (modelId.includes('haiku'))  return 'hai';
  if (modelId.includes('opus'))   return 'ops';
  if (modelId.includes('sonnet')) return 'son';
  // OpenRouter model IDs
  if (modelId.includes('deepseek'))  return 'ds';
  if (modelId.includes('glm'))       return 'glm';
  if (modelId.includes('kimi'))      return 'kimi';
  if (modelId.includes('gemini'))    return 'gem';
  return '';
}

function labelFromModelId(modelId) {
  return MODEL_LABELS[modelId] || modelId || '';
}

function profileKeyFromModelId(modelId) {
  if (!modelId) return '';
  // Anthropic native IDs
  if (modelId.includes('haiku'))  return 'haiku';
  if (modelId.includes('opus'))   return 'opus';
  if (modelId.includes('sonnet')) return 'sonnet';
  // OpenRouter model keys
  if (modelId.includes('deepseek'))  return 'deepseek';
  if (modelId.includes('glm'))       return 'glm';
  if (modelId.includes('kimi'))      return 'kimi';
  if (modelId.includes('gemini'))    return 'gemini';
  return '';
}

function emojiFromModelId(modelId) {
  const key = profileKeyFromModelId(modelId);
  return MODEL_EMOJI[key] || '';
}

function isOpenRouterModelId(modelId) {
  if (!modelId) return false;
  return modelId.includes('/');
}

module.exports = {
  MODEL_IDS,
  MODEL_LABELS,
  MODEL_EMOJI,
  VALID_PROFILES,
  VALID_MODES,
  PROFILE_MATRIX,
  DEPRECATED_MODES,
  DEPRECATED_ROLES,
  normalizeMode,
  normalizeProfile,
  resolveProfile,
  autoDetectProfile,
  shortNameFromModelId,
  labelFromModelId,
  profileKeyFromModelId,
  emojiFromModelId,
  isOpenRouterModelId,
};
