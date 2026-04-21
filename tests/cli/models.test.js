'use strict';

const path = require('path');
const {
  MODEL_IDS,
  VALID_MODES,
  VALID_PROFILES,
  PROFILE_MATRIX,
  normalizeMode,
  normalizeProfile,
  resolveProfile,
  autoDetectProfile,
  labelFromModelId,
  emojiFromModelId,
  shortNameFromModelId,
} = require('../../lib/models');

describe('models — PROFILE_MATRIX', () => {
  test('power profile: default→sonnet, economy→haiku, no-sonnet→opus', () => {
    expect(PROFILE_MATRIX.power.default).toBe('sonnet');
    expect(PROFILE_MATRIX.power.economy).toBe('haiku');
    expect(PROFILE_MATRIX.power['no-sonnet']).toBe('opus');
  });

  test('standard profile: all modes → haiku', () => {
    expect(PROFILE_MATRIX.standard.default).toBe('haiku');
    expect(PROFILE_MATRIX.standard.economy).toBe('haiku');
    expect(PROFILE_MATRIX.standard['no-sonnet']).toBe('haiku');
  });

  test('balanced profile: default→sonnet, economy→haiku, no-sonnet→haiku', () => {
    expect(PROFILE_MATRIX.balanced.default).toBe('sonnet');
    expect(PROFILE_MATRIX.balanced.economy).toBe('haiku');
    expect(PROFILE_MATRIX.balanced['no-sonnet']).toBe('haiku');
  });
});

describe('models — normalizeMode', () => {
  test('passes valid modes through', () => {
    expect(normalizeMode('default')).toBe('default');
    expect(normalizeMode('economy')).toBe('economy');
    expect(normalizeMode('no-sonnet')).toBe('no-sonnet');
  });

  test('lean → economy', () => {
    expect(normalizeMode('lean')).toBe('economy');
  });

  test('quota-save → no-sonnet', () => {
    expect(normalizeMode('quota-save')).toBe('no-sonnet');
  });
});

describe('models — normalizeProfile', () => {
  test('passes valid profiles through', () => {
    for (const p of VALID_PROFILES) {
      expect(normalizeProfile(p)).toBe(p);
    }
  });

  test('deprecated role hub → power', () => {
    expect(normalizeProfile('hub')).toBe('power');
  });

  test('deprecated role worker → balanced', () => {
    expect(normalizeProfile('worker')).toBe('balanced');
  });

  test('deprecated role default → balanced', () => {
    expect(normalizeProfile('default')).toBe('balanced');
  });

  test('undefined/null → balanced', () => {
    expect(normalizeProfile(undefined)).toBe('balanced');
    expect(normalizeProfile(null)).toBe('balanced');
    expect(normalizeProfile('')).toBe('balanced');
  });

  test('unknown value → balanced', () => {
    expect(normalizeProfile('garbage')).toBe('balanced');
  });
});

describe('models — resolveProfile (matrix resolution)', () => {
  test('power × default → sonnet', () => {
    expect(resolveProfile('default', 'power')).toBe('sonnet');
  });

  test('power × no-sonnet → opus', () => {
    expect(resolveProfile('no-sonnet', 'power')).toBe('opus');
  });

  test('standard × default → haiku', () => {
    expect(resolveProfile('default', 'standard')).toBe('haiku');
  });

  test('balanced × economy → haiku', () => {
    expect(resolveProfile('economy', 'balanced')).toBe('haiku');
  });

  test('deprecated mode resolves correctly', () => {
    expect(resolveProfile('lean', 'power')).toBe('haiku');
    expect(resolveProfile('quota-save', 'power')).toBe('opus');
  });

  test('deprecated role resolves correctly', () => {
    expect(resolveProfile('no-sonnet', 'hub')).toBe('opus');
    expect(resolveProfile('default', 'worker')).toBe('sonnet');
  });
});

describe('models — autoDetectProfile', () => {
  test('techcon_hub → power', () => {
    expect(autoDetectProfile('/foo/techcon_hub')).toBe('power');
  });

  test('rgs_hub → power', () => {
    expect(autoDetectProfile('/foo/rgs_hub')).toBe('power');
  });

  test('claude-scaffold → power', () => {
    expect(autoDetectProfile('/foo/claude-scaffold')).toBe('power');
  });

  test('dumpster → power', () => {
    expect(autoDetectProfile('/foo/dumpster')).toBe('power');
  });

  test('techcon_defectoscopy → standard', () => {
    expect(autoDetectProfile('/foo/techcon_defectoscopy')).toBe('standard');
  });

  test('techcon_demos → standard', () => {
    expect(autoDetectProfile('/foo/techcon_demos')).toBe('standard');
  });

  test('rgs_something → balanced', () => {
    expect(autoDetectProfile('/foo/rgs_budget_analysis')).toBe('balanced');
  });

  test('filemind (no prefix) → balanced', () => {
    expect(autoDetectProfile('/foo/filemind')).toBe('balanced');
  });

  test('case-insensitive matching', () => {
    expect(autoDetectProfile('/foo/TechCon_Passports')).toBe('standard');
  });

  test('empty path → balanced', () => {
    expect(autoDetectProfile('')).toBe('balanced');
    expect(autoDetectProfile(null)).toBe('balanced');
  });
});

describe('models — labelFromModelId', () => {
  test('sonnet full ID → Sonnet 4.6', () => {
    expect(labelFromModelId(MODEL_IDS.sonnet)).toBe('Sonnet 4.6');
  });

  test('haiku full ID → Haiku 4.5', () => {
    expect(labelFromModelId(MODEL_IDS.haiku)).toBe('Haiku 4.5');
  });

  test('opus full ID → Opus 4.6', () => {
    expect(labelFromModelId(MODEL_IDS.opus)).toBe('Opus 4.6');
  });

  test('unknown ID passes through as-is', () => {
    expect(labelFromModelId('unknown-model')).toBe('unknown-model');
  });

  test('empty → empty string', () => {
    expect(labelFromModelId('')).toBe('');
    expect(labelFromModelId(null)).toBe('');
  });
});

describe('models — emojiFromModelId', () => {
  test('sonnet → 🔵', () => {
    expect(emojiFromModelId(MODEL_IDS.sonnet)).toBe('🔵');
  });

  test('haiku → 🟢', () => {
    expect(emojiFromModelId(MODEL_IDS.haiku)).toBe('🟢');
  });

  test('opus → 🟣', () => {
    expect(emojiFromModelId(MODEL_IDS.opus)).toBe('🟣');
  });

  test('unknown → empty', () => {
    expect(emojiFromModelId('unknown')).toBe('');
  });
});

describe('models — shortNameFromModelId (backward compat)', () => {
  test('sonnet → son', () => {
    expect(shortNameFromModelId(MODEL_IDS.sonnet)).toBe('son');
  });

  test('haiku → hai', () => {
    expect(shortNameFromModelId(MODEL_IDS.haiku)).toBe('hai');
  });

  test('opus → ops', () => {
    expect(shortNameFromModelId(MODEL_IDS.opus)).toBe('ops');
  });
});

describe('models — constants', () => {
  test('VALID_MODES includes all three modes', () => {
    expect(VALID_MODES).toEqual(['default', 'economy', 'no-sonnet']);
  });

  test('VALID_PROFILES includes all three profiles', () => {
    expect(VALID_PROFILES).toEqual(['power', 'standard', 'balanced']);
  });
});
