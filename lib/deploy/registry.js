'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_REGISTRY_PATH = path.join(__dirname, '..', '..', 'deployed-repos.json');

function loadRegistry(registryPath) {
  const rp = registryPath || DEFAULT_REGISTRY_PATH;
  if (fs.existsSync(rp)) {
    return JSON.parse(fs.readFileSync(rp, 'utf8'));
  }
  return { deployed: [] };
}

function saveRegistry(registry, registryPath) {
  const rp = registryPath || DEFAULT_REGISTRY_PATH;
  fs.writeFileSync(rp, JSON.stringify(registry, null, 2), 'utf8');
}

function registerDeploy(infraDir, targetDir, options, registryPath) {
  const { getCurrentSha } = require('./git');
  const sha = getCurrentSha(infraDir);

  const versionFile = path.join(targetDir, '.claude', 'infra-version');
  fs.writeFileSync(versionFile, sha, 'utf8');

  const registry = loadRegistry(registryPath);
  const entry = {
    path: targetDir,
    skills: options.skills || [],
    ci_profile: options.ciProfile || '',
    deploy_target: options.deployTarget || 'none',
    deployed_at: new Date().toISOString().slice(0, 10),
    infra_sha: sha,
  };

  const idx = registry.deployed.findIndex(e => e.path === targetDir);
  if (idx >= 0) {
    registry.deployed[idx] = entry;
  } else {
    registry.deployed.push(entry);
  }

  saveRegistry(registry, registryPath);
  return sha;
}

module.exports = { loadRegistry, saveRegistry, registerDeploy, DEFAULT_REGISTRY_PATH };
