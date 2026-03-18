'use strict';

const fs = require('fs');
const path = require('path');
const copy = require('../deploy/copy');
const { registerDeploy } = require('../deploy/registry');
const { deployOrgTemplate, writeScaffoldMeta } = require('./org-profile');

const PROFILE_RESULT = { COPIED: 'copied', SKIPPED: 'skipped', NOT_FOUND: 'not_found' };

function copyProfileTemplate(infraDir, targetDir, profileName, lang) {
  const langSuffix = (lang === 'ru') ? 'ru' : 'en';
  const templatePath = path.join(
    infraDir, 'templates', 'profiles', profileName, `CLAUDE.md.${langSuffix}`
  );
  if (!fs.existsSync(templatePath)) return PROFILE_RESULT.NOT_FOUND;

  const destPath = path.join(targetDir, '.claude', 'CLAUDE.md');
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(templatePath, destPath);
    return PROFILE_RESULT.COPIED;
  }
  return PROFILE_RESULT.SKIPPED;
}

function deployCore(infraDir, targetDir, options) {
  const skills = options.skills || [];
  if (skills.length === 0) {
    throw new Error('No skills specified for deploy');
  }

  if (options.dryRun) {
    const hooksDir = path.join(infraDir, '.claude', 'hooks');
    const agentsDir = path.join(infraDir, '.claude', 'agents');
    const commandsDir = path.join(infraDir, '.claude', 'commands');
    const hooksCount = fs.existsSync(hooksDir) ? fs.readdirSync(hooksDir).filter(f => !f.startsWith('.')).length : 0;
    const agentsCount = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length : 0;
    const commandsCount = fs.existsSync(commandsDir) ? fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')).length : 0;
    process.stdout.write('[dry-run] claude-scaffold init plan:\n');
    process.stdout.write(`  Copy hooks (${hooksCount} files)     →  ${path.join(targetDir, '.claude', 'hooks')}\n`);
    process.stdout.write(`  Copy agents (${agentsCount} files)   →  ${path.join(targetDir, '.claude', 'agents')}\n`);
    process.stdout.write(`  Copy commands (${commandsCount} files) →  ${path.join(targetDir, '.claude', 'commands')}\n`);
    process.stdout.write(`  Copy skills: ${skills.join(', ')}\n`);
    process.stdout.write(`  Create .claude/settings.json\n`);
    process.stdout.write(`  Create dev/status.md\n`);
    process.stdout.write(`  Update .gitignore (add .claude/)\n`);
    if (options.profile) {
      process.stdout.write(`  Copy CLAUDE.md (profile: ${options.profile}, lang: ${options.lang || 'en'})\n`);
    }
    if (options.orgProfile) {
      process.stdout.write(`  Org-profile: ${options.orgProfile}/${options.orgType} (lang: ${options.lang || 'en'})\n`);
    }
    process.stdout.write(`  Write .scaffold-meta.json\n`);
    process.stdout.write(`  Register in deployed-repos.json\n`);
    return;
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
    const result = copyProfileTemplate(infraDir, targetDir, options.profile, options.lang || 'en');
    if (result === PROFILE_RESULT.NOT_FOUND) {
      process.stderr.write(`[init] Warning: profile template '${options.profile}' not found — CLAUDE.md not copied\n`);
    }
  }

  if (options.orgProfile) {
    deployOrgTemplate(infraDir, targetDir, options.orgProfile, options.orgType, options.lang || 'en');
  }

  writeScaffoldMeta(infraDir, targetDir, {
    baseProfile: options.profile || '',
    org: options.orgProfile,
    type: options.orgType,
  });

  const lang = options.lang || 'en';
  if (lang !== 'en') {
    const configPath = path.join(targetDir, '.claude', 'project-config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    }
    if (!config.lang) {
      config.lang = lang;
      config.session_count = config.session_count || 0;
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
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

module.exports = { deployCore, copyProfileTemplate, PROFILE_RESULT };
