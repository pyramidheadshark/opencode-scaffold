'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock ccr-config to return null so tests use legacy path
jest.mock('../../lib/ccr-config', () => ({
  readCCRConfig: jest.fn(() => null),
  MODE_CCR_ROUTING: {},
  PROFILE_CCR_ROUTING: {},
  writeCCRConfig: jest.fn(),
  writeScaffoldMode: jest.fn(),
  restartCCR: jest.fn(() => Promise.resolve(true)),
}));

const {
  applyMode,
  setProfile,
  setRole,
  autoAssignProfiles,
  showStatus,
  writeSettingsModel,
} = require('../../lib/commands/mode');

let tmpRoot;
let registryPath;

function makeRepo(name, opts = {}) {
  const repoPath = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(repoPath, '.claude'), { recursive: true });
  if (opts.model) {
    const settingsPath = path.join(repoPath, '.claude', 'settings.json');
    const settings = { model: opts.model, env: { CLAUDE_CODE_EFFORT_LEVEL: 'max' } };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }
  return repoPath;
}

function writeRegistry(entries) {
  fs.writeFileSync(registryPath, JSON.stringify({ deployed: entries }, null, 2), 'utf8');
}

function readRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function readRepoSettings(repoPath) {
  const p = path.join(repoPath, '.claude', 'settings.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-mode-'));
  registryPath = path.join(tmpRoot, 'deployed-repos.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mode — writeSettingsModel', () => {
  test('sets model ID in settings.json (haiku)', () => {
    const repo = makeRepo('repo1');
    writeSettingsModel(repo, 'haiku');
    const s = readRepoSettings(repo);
    expect(s.model).toBe('claude-haiku-4-5-20251001');
  });

  test('removes CLAUDE_CODE_EFFORT_LEVEL for haiku', () => {
    const repo = makeRepo('repo1', { model: 'claude-sonnet-4-6' });
    writeSettingsModel(repo, 'haiku');
    const s = readRepoSettings(repo);
    expect(s.env.CLAUDE_CODE_EFFORT_LEVEL).toBeUndefined();
  });

  test('sets CLAUDE_CODE_EFFORT_LEVEL=medium for opus', () => {
    const repo = makeRepo('repo1');
    writeSettingsModel(repo, 'opus');
    const s = readRepoSettings(repo);
    expect(s.model).toBe('claude-opus-4-7');
    expect(s.env.CLAUDE_CODE_EFFORT_LEVEL).toBe('medium');
  });

  test('keeps CLAUDE_CODE_EFFORT_LEVEL=max for sonnet', () => {
    const repo = makeRepo('repo1');
    writeSettingsModel(repo, 'sonnet');
    const s = readRepoSettings(repo);
    expect(s.model).toBe('claude-sonnet-4-6');
    expect(s.env.CLAUDE_CODE_EFFORT_LEVEL).toBe('max');
  });

  test('rejects unknown profile', () => {
    const repo = makeRepo('repo1');
    expect(() => writeSettingsModel(repo, 'nonexistent')).toThrow();
  });

  test('creates settings.json if absent', () => {
    const repo = makeRepo('repo1');
    writeSettingsModel(repo, 'sonnet');
    const s = readRepoSettings(repo);
    expect(s).not.toBeNull();
    expect(s.model).toBe('claude-sonnet-4-6');
  });
});

describe('mode — applyMode with base_profile matrix', () => {
  test('default mode: power→sonnet, standard→haiku, balanced→haiku', () => {
    const power = makeRepo('techcon_hub');
    const std = makeRepo('techcon_worker');
    const bal = makeRepo('rgs_something');
    writeRegistry([
      { path: power, base_profile: 'power', skills: [], ci_profile: '', deploy_target: 'none' },
      { path: std, base_profile: 'standard', skills: [], ci_profile: '', deploy_target: 'none' },
      { path: bal, base_profile: 'balanced', skills: [], ci_profile: '', deploy_target: 'none' },
    ]);

    applyMode('default', { registryPath });

    expect(readRepoSettings(power).model).toBe('claude-sonnet-4-6');
    expect(readRepoSettings(std).model).toBe('claude-haiku-4-5-20251001');
    expect(readRepoSettings(bal).model).toBe('claude-haiku-4-5-20251001');
  });

  test('economy mode: all profiles → haiku', () => {
    const power = makeRepo('power-repo');
    const std = makeRepo('std-repo');
    const bal = makeRepo('bal-repo');
    writeRegistry([
      { path: power, base_profile: 'power', skills: [] },
      { path: std, base_profile: 'standard', skills: [] },
      { path: bal, base_profile: 'balanced', skills: [] },
    ]);

    applyMode('economy', { registryPath });

    expect(readRepoSettings(power).model).toBe('claude-haiku-4-5-20251001');
    expect(readRepoSettings(std).model).toBe('claude-haiku-4-5-20251001');
    expect(readRepoSettings(bal).model).toBe('claude-haiku-4-5-20251001');
  });

  test('no-sonnet mode: power→opus, standard→haiku, balanced→opus', () => {
    const power = makeRepo('power-repo');
    const std = makeRepo('std-repo');
    const bal = makeRepo('bal-repo');
    writeRegistry([
      { path: power, base_profile: 'power', skills: [] },
      { path: std, base_profile: 'standard', skills: [] },
      { path: bal, base_profile: 'balanced', skills: [] },
    ]);

    applyMode('no-sonnet', { registryPath });

    expect(readRepoSettings(power).model).toBe('claude-opus-4-7');
    expect(readRepoSettings(std).model).toBe('claude-haiku-4-5-20251001');
    expect(readRepoSettings(bal).model).toBe('claude-opus-4-7');
  });

  test('stores active_mode and model_id in registry', () => {
    const repo = makeRepo('r1');
    writeRegistry([{ path: repo, base_profile: 'power', skills: [] }]);
    applyMode('no-sonnet', { registryPath });
    const reg = readRegistry();
    expect(reg.active_mode).toBe('no-sonnet');
    expect(reg.deployed[0].model_profile).toBe('opus');
    expect(reg.deployed[0].model_id).toBe('claude-opus-4-7');
  });

  test('deprecated mode "lean" normalized to "economy"', () => {
    const repo = makeRepo('r1');
    writeRegistry([{ path: repo, base_profile: 'balanced', skills: [] }]);
    applyMode('lean', { registryPath });
    expect(readRepoSettings(repo).model).toBe('claude-haiku-4-5-20251001');
    expect(readRegistry().active_mode).toBe('economy');
  });

  test('deprecated mode "quota-save" normalized to "no-sonnet"', () => {
    const repo = makeRepo('r1');
    writeRegistry([{ path: repo, base_profile: 'power', skills: [] }]);
    applyMode('quota-save', { registryPath });
    expect(readRepoSettings(repo).model).toBe('claude-opus-4-7');
    expect(readRegistry().active_mode).toBe('no-sonnet');
  });

  test('deprecated role "hub" migrated to base_profile "power"', () => {
    const repo = makeRepo('r1');
    writeRegistry([{ path: repo, role: 'hub', skills: [] }]);
    applyMode('no-sonnet', { registryPath });
    const reg = readRegistry();
    expect(reg.deployed[0].base_profile).toBe('power');
    expect(reg.deployed[0].role).toBeUndefined();
    expect(readRepoSettings(repo).model).toBe('claude-opus-4-7');
  });

  test('unknown mode throws', () => {
    writeRegistry([]);
    expect(() => applyMode('invalid-mode', { registryPath })).toThrow(/Unknown mode/);
  });

  test('missing repo directory marked as missing', () => {
    writeRegistry([
      { path: path.join(tmpRoot, 'ghost-repo'), base_profile: 'balanced', skills: [] },
    ]);
    const { results } = applyMode('economy', { registryPath });
    expect(results[0].status).toBe('missing');
  });

  test('economy mode strips CLAUDE_CODE_EFFORT_LEVEL', () => {
    const repo = makeRepo('repo', { model: 'claude-sonnet-4-6' });
    writeRegistry([{ path: repo, base_profile: 'balanced', skills: [] }]);
    applyMode('economy', { registryPath });
    const s = readRepoSettings(repo);
    expect(s.env.CLAUDE_CODE_EFFORT_LEVEL).toBeUndefined();
  });
});

describe('mode — setProfile', () => {
  test('changes base_profile for registered repo', () => {
    const repo = makeRepo('repo1');
    writeRegistry([{ path: repo, base_profile: 'balanced', skills: [] }]);

    const out = setProfile(repo, 'power', { registryPath });

    expect(out.previous).toBe('balanced');
    expect(out.profile).toBe('power');
    const reg = readRegistry();
    expect(reg.deployed[0].base_profile).toBe('power');
  });

  test('throws if repo not registered', () => {
    writeRegistry([]);
    expect(() => setProfile('/nonexistent/path', 'power', { registryPath })).toThrow(/not found/);
  });

  test('rejects invalid profile', () => {
    const repo = makeRepo('repo1');
    writeRegistry([{ path: repo, base_profile: 'balanced', skills: [] }]);
    expect(() => setProfile(repo, 'invalid-profile', { registryPath })).toThrow(/Unknown profile/);
  });

  test('setRole alias works (backward compat)', () => {
    const repo = makeRepo('repo1');
    writeRegistry([{ path: repo, base_profile: 'balanced', skills: [] }]);
    const out = setRole(repo, 'power', { registryPath });
    expect(out.profile).toBe('power');
  });
});

describe('mode — autoAssignProfiles', () => {
  test('assigns power to techcon_hub, rgs_hub, dumpster', () => {
    const hub1 = makeRepo('techcon_hub');
    const hub2 = makeRepo('rgs_hub');
    const dump = makeRepo('dumpster');
    writeRegistry([
      { path: hub1, skills: [] },
      { path: hub2, skills: [] },
      { path: dump, skills: [] },
    ]);

    autoAssignProfiles({ registryPath });

    const reg = readRegistry();
    expect(reg.deployed[0].base_profile).toBe('power');
    expect(reg.deployed[1].base_profile).toBe('power');
    expect(reg.deployed[2].base_profile).toBe('power');
  });

  test('assigns standard to techcon_* non-hub repos', () => {
    const repo = makeRepo('techcon_defectoscopy');
    writeRegistry([{ path: repo, skills: [] }]);
    autoAssignProfiles({ registryPath });
    expect(readRegistry().deployed[0].base_profile).toBe('standard');
  });

  test('assigns balanced to rgs_* repos', () => {
    const repo = makeRepo('rgs_something');
    writeRegistry([{ path: repo, skills: [] }]);
    autoAssignProfiles({ registryPath });
    expect(readRegistry().deployed[0].base_profile).toBe('balanced');
  });

  test('assigns balanced to repos without prefix', () => {
    const repo = makeRepo('filemind');
    writeRegistry([{ path: repo, skills: [] }]);
    autoAssignProfiles({ registryPath });
    expect(readRegistry().deployed[0].base_profile).toBe('balanced');
  });

  test('keeps manually-set profile without --force', () => {
    const repo = makeRepo('techcon_defectoscopy');
    writeRegistry([{ path: repo, base_profile: 'power', skills: [] }]);
    const results = autoAssignProfiles({ registryPath });
    expect(results[0].status).toBe('kept');
    expect(readRegistry().deployed[0].base_profile).toBe('power');
  });

  test('overrides manually-set profile with --force', () => {
    const repo = makeRepo('techcon_defectoscopy');
    writeRegistry([{ path: repo, base_profile: 'power', skills: [] }]);
    autoAssignProfiles({ registryPath, force: true });
    expect(readRegistry().deployed[0].base_profile).toBe('standard');
  });
});

describe('mode — showStatus', () => {
  test('returns entries for all registered repos', () => {
    const r1 = makeRepo('r1');
    const r2 = makeRepo('r2');
    writeRegistry([
      { path: r1, base_profile: 'power', model_id: 'claude-sonnet-4-6', skills: [] },
      { path: r2, base_profile: 'standard', model_id: 'claude-haiku-4-5-20251001', skills: [] },
    ]);

    const { entries } = showStatus({ registryPath });

    expect(entries).toHaveLength(2);
    expect(entries[0].baseProfile).toBe('power');
    expect(entries[0].registryModelLabel).toBe('Sonnet 4.6');
    expect(entries[1].registryModelLabel).toBe('Haiku 4.5');
  });

  test('detects drift when settings.json disagrees with registry', () => {
    const repo = makeRepo('repo1', { model: 'claude-opus-4-7' });
    writeRegistry([
      { path: repo, base_profile: 'balanced', model_id: 'claude-sonnet-4-6', skills: [] },
    ]);

    const { entries } = showStatus({ registryPath });

    expect(entries[0].match).toBe(false);
  });

  test('returns active_mode from registry', () => {
    writeRegistry([]);
    const registry = readRegistry();
    registry.active_mode = 'no-sonnet';
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
    expect(showStatus({ registryPath }).activeMode).toBe('no-sonnet');
  });

  test('marks repo as not exists when directory missing', () => {
    writeRegistry([
      { path: path.join(tmpRoot, 'ghost'), base_profile: 'balanced', skills: [] },
    ]);
    const { entries } = showStatus({ registryPath });
    expect(entries[0].exists).toBe(false);
  });
});
