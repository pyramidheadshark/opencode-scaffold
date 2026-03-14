'use strict';

const fs = require('fs');
const path = require('path');
const copy = require('../deploy/copy');
const { loadRegistry, registerDeploy } = require('../deploy/registry');
const { getCurrentSha } = require('../deploy/git');

function updateOne(infraDir, targetDir, registryPath) {
  const registry = loadRegistry(registryPath);
  const entry = registry.deployed.find(e => e.path === targetDir);
  if (!entry) {
    throw new Error(`${targetDir} not found in registry. Run init first.`);
  }

  const skills = entry.skills || [];

  copy.copyHooks(infraDir, targetDir);
  copy.copyAgents(infraDir, targetDir);
  copy.copyCommands(infraDir, targetDir);

  const skillsDir = path.join(targetDir, '.claude', 'skills');
  for (const skill of skills) {
    const src = path.join(infraDir, '.claude', 'skills', skill);
    if (!fs.existsSync(src)) continue;
    copy.copyDirRecursive(src, path.join(skillsDir, skill));
  }

  copy.generateSkillRules(infraDir, targetDir, skills);
  copy.deploySettings(targetDir);

  registerDeploy(
    infraDir,
    targetDir,
    {
      skills,
      ciProfile: entry.ci_profile || '',
      deployTarget: entry.deploy_target || 'none',
    },
    registryPath
  );
}

function updateAll(infraDir, registryPath) {
  const registry = loadRegistry(registryPath);
  const currentSha = getCurrentSha(infraDir);

  let updated = 0;
  let skipped = 0;

  for (const entry of registry.deployed) {
    const versionFile = path.join(entry.path, '.claude', 'infra-version');
    const repoSha = fs.existsSync(versionFile)
      ? fs.readFileSync(versionFile, 'utf8').trim()
      : '';

    if (repoSha === currentSha) {
      skipped++;
      continue;
    }

    if (!fs.existsSync(entry.path)) {
      skipped++;
      continue;
    }

    updateOne(infraDir, entry.path, registryPath);
    updated++;
  }

  return { updated, skipped };
}

module.exports = { updateOne, updateAll };
