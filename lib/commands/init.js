'use strict';

const fs = require('fs');
const path = require('path');
const copy = require('../deploy/copy');
const { registerDeploy } = require('../deploy/registry');

function copyProfileTemplate(infraDir, targetDir, profileName, lang) {
  const langSuffix = (lang === 'ru') ? 'ru' : 'en';
  const templatePath = path.join(
    infraDir, 'templates', 'profiles', profileName, `CLAUDE.md.${langSuffix}`
  );
  if (!fs.existsSync(templatePath)) return false;

  const destPath = path.join(targetDir, '.claude', 'CLAUDE.md');
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(templatePath, destPath);
    return true;
  }
  return false;
}

function deployCore(infraDir, targetDir, options) {
  const skills = options.skills || [];
  if (skills.length === 0) {
    throw new Error('No skills specified for deploy');
  }

  fs.mkdirSync(targetDir, { recursive: true });

  copy.copyHooks(infraDir, targetDir);
  copy.copyAgents(infraDir, targetDir);
  copy.copyCommands(infraDir, targetDir);

  for (const skill of skills) {
    const src = path.join(infraDir, '.claude', 'skills', skill);
    if (!fs.existsSync(src)) {
      process.stderr.write(`WARN: skill '${skill}' not found, skipping\n`);
      continue;
    }
    copy.copyDirRecursive(src, path.join(targetDir, '.claude', 'skills', skill));
  }

  copy.generateSkillRules(infraDir, targetDir, skills);
  copy.deploySettings(targetDir);
  copy.createDevStatus(infraDir, targetDir);
  copy.ensureGitignore(targetDir);

  if (options.profile) {
    copyProfileTemplate(infraDir, targetDir, options.profile, options.lang || 'en');
  }

  registerDeploy(
    infraDir,
    targetDir,
    {
      skills,
      ciProfile: options.ciProfile || '',
      deployTarget: options.deployTarget || 'none',
    },
    options.registryPath
  );
}

module.exports = { deployCore, copyProfileTemplate };
