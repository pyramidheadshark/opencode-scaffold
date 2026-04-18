'use strict';

const fs = require('fs');
const path = require('path');
const { loadRegistry, DEFAULT_REGISTRY_PATH } = require('../deploy/registry');
const { runTune } = require('../commands/tune');
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

function getSettings(repoPath) {
  const settingsPath = path.join(repoPath, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return null;
  }
}

function setEffort(repoPath, level) {
  return runTune(repoPath, { effort: level });
}

function toggleThinkingSummaries(repoPath) {
  const settings = getSettings(repoPath) || {};
  const current = settings.showThinkingSummaries !== false;
  return runTune(repoPath, { thinkingSummaries: current ? 'off' : 'on' });
}

function updateRepo(infraDir, repoPath, registryPath) {
  const { updateOne } = require('../commands/update');
  updateOne(infraDir, repoPath, registryPath || DEFAULT_REGISTRY_PATH, {});
}

function getAvailableProfiles() {
  return Object.keys(PROFILES);
}

module.exports = {
  listRepos,
  getSkillRules,
  getSettings,
  setEffort,
  toggleThinkingSummaries,
  updateRepo,
  getAvailableProfiles,
};
