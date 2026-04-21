'use strict';

const MODEL_IDS = Object.freeze({
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
  opus:   'claude-opus-4-6',
});

const MODES = Object.freeze({
  default:      Object.freeze({ hub: 'sonnet', worker: 'sonnet' }),
  'quota-save': Object.freeze({ hub: 'opus',   worker: 'haiku'  }),
  lean:         Object.freeze({ hub: 'haiku',  worker: 'haiku'  }),
});

const VALID_PROFILES = Object.freeze(Object.keys(MODEL_IDS));
const VALID_MODES    = Object.freeze(Object.keys(MODES));
const VALID_ROLES    = Object.freeze(['hub', 'worker', 'default']);

function resolveProfileForRole(modeName, role) {
  const modeDef = MODES[modeName];
  if (!modeDef) return null;
  const effectiveRole = (role && role !== 'default') ? role : 'worker';
  return modeDef[effectiveRole] || modeDef.worker;
}

function shortNameFromModelId(modelId) {
  if (!modelId) return '';
  if (modelId.includes('haiku'))  return 'hai';
  if (modelId.includes('opus'))   return 'ops';
  if (modelId.includes('sonnet')) return 'son';
  return '';
}

module.exports = {
  MODEL_IDS,
  MODES,
  VALID_PROFILES,
  VALID_MODES,
  VALID_ROLES,
  resolveProfileForRole,
  shortNameFromModelId,
};
