'use strict';

const fs = require('fs');
const path = require('path');
const {
  MODEL_IDS,
  VALID_MODES,
  VALID_PROFILES,
  DEPRECATED_MODES,
  normalizeMode,
  normalizeProfile,
  resolveProfile,
  autoDetectProfile,
  labelFromModelId,
} = require('../models');
const { loadRegistry, saveRegistry, DEFAULT_REGISTRY_PATH } = require('../deploy/registry');
const ccr = require('../ccr-config');

function normalizePath(p) {
  return path.resolve(p);
}

function readSettings(repoPath) {
  const settingsPath = path.join(repoPath, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return { settingsPath, data: null };
  try {
    return { settingsPath, data: JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  } catch {
    return { settingsPath, data: null };
  }
}

function writeSettingsModel(repoPath, profileName) {
  const modelId = MODEL_IDS[profileName];
  if (!modelId) {
    throw new Error(`Unknown model profile: ${profileName}`);
  }
  const { settingsPath, data } = readSettings(repoPath);
  const settings = data || {};
  const oldModelId = settings.model || null;
  settings.model = modelId;
  settings.env = settings.env || {};
  if (profileName === 'haiku') {
    if (settings.env.CLAUDE_CODE_EFFORT_LEVEL) {
      delete settings.env.CLAUDE_CODE_EFFORT_LEVEL;
    }
  } else if (!settings.env.CLAUDE_CODE_EFFORT_LEVEL) {
    settings.env.CLAUDE_CODE_EFFORT_LEVEL = profileName === 'opus' ? 'medium' : 'max';
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return { oldModelId, newModelId: modelId };
}

function applyMode(modeName, opts = {}) {
  const mode = normalizeMode(modeName);
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Unknown mode: ${modeName}. Valid: ${VALID_MODES.join(', ')}`);
  }

  // CCR-aware mode switching
  const ccrConfig = ccr.readCCRConfig();
  if (ccrConfig) {
    return applyModeCCR(mode, opts, ccrConfig);
  }

  // Legacy mode switching (no CCR)
  const registryPath = opts.registryPath || DEFAULT_REGISTRY_PATH;
  const registry = loadRegistry(registryPath);
  const results = [];

  for (const entry of registry.deployed) {
    const baseProfile = normalizeProfile(entry.base_profile || entry.role);
    const targetModelProfile = resolveProfile(mode, baseProfile);
    if (!targetModelProfile) continue;

    const result = {
      path: entry.path,
      baseProfile,
      modelProfile: targetModelProfile,
      oldModelId: entry.model_id || null,
      newModelId: MODEL_IDS[targetModelProfile],
      label: labelFromModelId(MODEL_IDS[targetModelProfile]),
      status: 'missing',
    };

    if (fs.existsSync(entry.path)) {
      try {
        const { oldModelId } = writeSettingsModel(entry.path, targetModelProfile);
        result.oldModelId = oldModelId;
        result.status = 'applied';
      } catch (e) {
        result.status = 'error';
        result.error = e.message;
      }
    }

    entry.base_profile = baseProfile;
    entry.model_profile = targetModelProfile;
    entry.model_id = MODEL_IDS[targetModelProfile];
    delete entry.model;
    delete entry.role;
    results.push(result);
  }

  registry.active_mode = mode;
  saveRegistry(registry, registryPath);
  return { mode, results };
}

function applyModeCCR(modeName, opts, ccrConfig) {
  const modeRouting = ccr.MODE_CCR_ROUTING[modeName];

  if (modeName === 'default' && !modeRouting) {
    // Restore profile-based routing
    const profile = ccrConfig.Router?._scaffoldProfile || 'ai-developer';
    const profileRouting = ccr.PROFILE_CCR_ROUTING[profile] || ccr.PROFILE_CCR_ROUTING['ai-developer'];
    ccrConfig.Router = { ...profileRouting, _scaffoldProfile: profile };
  } else if (modeRouting) {
    ccrConfig.Router = { ...ccrConfig.Router, ...modeRouting };
  }

  // Save profile reference in Router for 'default' mode restoration
  if (!ccrConfig.Router._scaffoldProfile) {
    ccrConfig.Router._scaffoldProfile = 'ai-developer';
  }

  ccr.writeCCRConfig(ccrConfig);
  ccr.writeScaffoldMode(modeName);

  const routerDisplay = { ...ccrConfig.Router };
  delete routerDisplay._scaffoldProfile;

  console.log(`✅ Mode set to "${modeName}". CCR Router updated.`);
  console.log('Router rules:', JSON.stringify(routerDisplay, null, 2));

  ccr.restartCCR().then(success => {
    if (!success) {
      console.log('⚠️  CCR not restarted. Run manually: ccr restart');
    }
  });

  return { mode: modeName, ccrRouting: routerDisplay };
}

function setProfile(repoPath, profileName, opts = {}) {
  const { DEPRECATED_ROLES } = require('../models');
  const isKnown = VALID_PROFILES.includes(profileName) || DEPRECATED_ROLES[profileName];
  if (!isKnown) {
    throw new Error(`Unknown profile: ${profileName}. Valid: ${VALID_PROFILES.join(', ')}`);
  }
  const profile = normalizeProfile(profileName);
  const registryPath = opts.registryPath || DEFAULT_REGISTRY_PATH;
  const registry = loadRegistry(registryPath);
  const resolved = normalizePath(repoPath);

  const entry = registry.deployed.find(e => normalizePath(e.path) === resolved);
  if (!entry) {
    throw new Error(`Repo not found in registry: ${resolved}`);
  }
  const previous = entry.base_profile || normalizeProfile(entry.role) || 'balanced';
  entry.base_profile = profile;
  delete entry.role;
  saveRegistry(registry, registryPath);
  return { path: entry.path, previous, profile };
}

function autoAssignProfiles(opts = {}) {
  const registryPath = opts.registryPath || DEFAULT_REGISTRY_PATH;
  const registry = loadRegistry(registryPath);
  const results = [];
  for (const entry of registry.deployed) {
    const detected = autoDetectProfile(entry.path);
    const previous = entry.base_profile || null;
    if (entry.base_profile && !opts.force) {
      results.push({ path: entry.path, detected, previous, status: 'kept' });
      continue;
    }
    entry.base_profile = detected;
    delete entry.role;
    results.push({ path: entry.path, detected, previous, status: 'assigned' });
  }
  saveRegistry(registry, registryPath);
  return results;
}

function showStatus(opts = {}) {
  const registryPath = opts.registryPath || DEFAULT_REGISTRY_PATH;
  const registry = loadRegistry(registryPath);
  const entries = [];

  for (const entry of registry.deployed) {
    const baseProfile = normalizeProfile(entry.base_profile || entry.role);
    const registryModelId = entry.model_id || null;
    const { data } = readSettings(entry.path);
    const settingsModelId = (data && data.model) || null;
    const match = settingsModelId && registryModelId
      ? settingsModelId === registryModelId
      : (!settingsModelId && !registryModelId);

    entries.push({
      path: entry.path,
      baseProfile,
      registryModelId,
      registryModelLabel: labelFromModelId(registryModelId),
      settingsModelId,
      settingsModelLabel: labelFromModelId(settingsModelId),
      match,
      exists: fs.existsSync(entry.path),
    });
  }

  return { activeMode: registry.active_mode || null, entries };
}

function formatStatusTable(rows) {
  if (rows.length === 0) return '  (no deployed repos)';
  const header = ['Repo', 'Profile', 'Model', 'Status'];
  const data = rows.map(r => [
    path.basename(r.path),
    r.baseProfile || 'balanced',
    r.registryModelLabel || r.settingsModelLabel || '—',
    r.exists ? (r.match ? 'ok' : 'drift') : 'missing',
  ]);
  const cols = header.map((h, i) => Math.max(h.length, ...data.map(d => String(d[i]).length)));
  const fmt = arr => '  ' + arr.map((v, i) => String(v).padEnd(cols[i])).join('  ');
  return [fmt(header), fmt(cols.map(c => '-'.repeat(c))), ...data.map(fmt)].join('\n');
}

function formatApplyTable(rows) {
  if (rows.length === 0) return '  (no repos to apply)';
  const header = ['Repo', 'Profile', 'Model', 'Status'];
  const data = rows.map(r => [
    path.basename(r.path),
    r.baseProfile || 'balanced',
    r.label || r.newModelId || '',
    r.status,
  ]);
  const cols = header.map((h, i) => Math.max(h.length, ...data.map(d => String(d[i]).length)));
  const fmt = arr => '  ' + arr.map((v, i) => String(v).padEnd(cols[i])).join('  ');
  return [fmt(header), fmt(cols.map(c => '-'.repeat(c))), ...data.map(fmt)].join('\n');
}

function run(args) {
  const [sub, ...rest] = args;
  const command = sub || 'status';

  if (command === 'status') {
    const status = showStatus();
    console.log();
    if (status.activeMode) {
      console.log(`  Active mode: ${status.activeMode}`);
    } else {
      console.log('  Active mode: (not set — run `claude-scaffold mode default|economy|no-sonnet`)');
    }
    console.log();
    console.log(formatStatusTable(status.entries));
    console.log();
    return;
  }

  if (command === 'set-profile' || command === 'set-role') {
    const profile = rest[0];
    const repoPath = rest[1];
    if (!profile || !repoPath) {
      console.error('Usage: claude-scaffold mode set-profile <power|standard|balanced> <repo-path>');
      process.exit(1);
    }
    try {
      const out = setProfile(repoPath, profile);
      console.log(`\n  ${path.basename(out.path)}: profile ${out.previous} → ${out.profile}\n`);
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  if (command === 'auto-assign') {
    const force = rest.includes('--force');
    const results = autoAssignProfiles({ force });
    console.log();
    for (const r of results) {
      const name = path.basename(r.path);
      if (r.status === 'kept') {
        console.log(`  ${name.padEnd(36)} kept (${r.previous || 'none'}; detected ${r.detected})`);
      } else {
        console.log(`  ${name.padEnd(36)} → ${r.detected}${r.previous ? ` (was ${r.previous})` : ''}`);
      }
    }
    console.log();
    return;
  }

  const normalizedMode = normalizeMode(command);
  if (VALID_MODES.includes(normalizedMode)) {
    if (DEPRECATED_MODES[command]) {
      console.error(`[deprecation] mode "${command}" is renamed to "${normalizedMode}". Using new name.`);
    }
    try {
      const out = applyMode(normalizedMode);
      console.log(`\n  Applied mode: ${out.mode}\n`);
      console.log(formatApplyTable(out.results));
      const errors = out.results.filter(r => r.status === 'error');
      if (errors.length > 0) {
        console.log(`\n  ${errors.length} error(s): check messages above.`);
      }
      console.log();
      console.log('  Note: Already-open Claude Code sessions keep their old model until restart.');
      console.log();
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown mode subcommand: ${command}`);
  console.error(`Valid: ${[...VALID_MODES, 'status', 'set-profile', 'auto-assign'].join(', ')}`);
  process.exit(1);
}

module.exports = {
  applyMode,
  setProfile,
  setRole: setProfile,
  autoAssignProfiles,
  showStatus,
  writeSettingsModel,
  formatStatusTable,
  formatApplyTable,
  run,
};
