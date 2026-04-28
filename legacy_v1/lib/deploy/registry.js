'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_REGISTRY_PATH = path.join(__dirname, '..', '..', 'deployed-repos.json');

function loadRegistry(registryPath) {
  const rp = registryPath || DEFAULT_REGISTRY_PATH;
  if (fs.existsSync(rp)) {
    try {
      return JSON.parse(fs.readFileSync(rp, 'utf8'));
    } catch (e) {
      process.stderr.write(`[claude-scaffold] Warning: registry corrupt, resetting. ${e.message}\n`);
      return { deployed: [] };
    }
  }
  return { deployed: [] };
}

function saveRegistry(registry, registryPath) {
  const rp = registryPath || DEFAULT_REGISTRY_PATH;
  fs.writeFileSync(rp, JSON.stringify(registry, null, 2), 'utf8');
}

function registerDeploy(infraDir, targetDir, options, registryPath) {
  const { getCurrentSha } = require('./git');
  const { normalizeProfile, autoDetectProfile, MODEL_IDS } = require('../models');
  const sha = getCurrentSha(infraDir);

  const versionFile = path.join(targetDir, '.claude', 'infra-version');
  if (!sha) {
    process.stderr.write('[claude-scaffold] Warning: could not read git SHA — infra-version will not be written\n');
  } else {
    fs.writeFileSync(versionFile, sha, 'utf8');
  }

  const registry = loadRegistry(registryPath);
  const idx = registry.deployed.findIndex(e => e.path === targetDir);
  const existing = idx >= 0 ? registry.deployed[idx] : {};

  const baseProfile = options.baseProfile
    || existing.base_profile
    || (existing.role ? normalizeProfile(existing.role) : null)
    || autoDetectProfile(targetDir);

  const entry = {
    path: targetDir,
    skills: options.skills || [],
    ci_profile: options.ciProfile || '',
    deploy_target: options.deployTarget || 'none',
    deployed_at: new Date().toISOString().slice(0, 10),
    infra_sha: sha,
    base_profile: baseProfile,
  };

  if (options.modelProfile) {
    entry.model_profile = options.modelProfile;
    entry.model_id = MODEL_IDS[options.modelProfile] || options.modelProfile;
  } else if (existing.model_profile) {
    entry.model_profile = existing.model_profile;
    entry.model_id = existing.model_id || MODEL_IDS[existing.model_profile];
  }

  if (idx >= 0) {
    registry.deployed[idx] = entry;
  } else {
    registry.deployed.push(entry);
  }

  saveRegistry(registry, registryPath);
  return sha;
}

module.exports = { loadRegistry, saveRegistry, registerDeploy, DEFAULT_REGISTRY_PATH };
