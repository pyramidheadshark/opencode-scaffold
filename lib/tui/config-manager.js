'use strict';

const fs = require('fs');
const path = require('path');
const { loadRegistry, DEFAULT_REGISTRY_PATH } = require('../deploy/registry');
const PROFILES = require('../profiles');

function listRepos(registryPath) {
  const registry = loadRegistry(registryPath || DEFAULT_REGISTRY_PATH);
  return registry.deployed.map(entry => ({
    path: entry.path,
    name: path.basename(entry.path),
    skills: entry.skills || [],
    ciProfile: entry.ci_profile || '',
    deployTarget: entry.deploy_target || 'none',
    deployedAt: entry.deployed_at || '',
    infraSha: entry.infra_sha || '',
  }));
}

function getSkillRules(repoPath) {
  const rulesPath = path.join(repoPath, '.claude', 'skills', 'skill-rules.json');
  if (!fs.existsSync(rulesPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    return Array.isArray(data.rules) ? data.rules : [];
  } catch {
    return [];
  }
}

function getAvailableProfiles() {
  return Object.keys(PROFILES);
}

module.exports = { listRepos, getSkillRules, getAvailableProfiles };
