#!/usr/bin/env node
'use strict';

const path = require('path');
const { Command } = require('commander');
const { deployCore } = require('../lib/commands/init');
const { updateOne, updateAll } = require('../lib/commands/update');
const { printStatusReport } = require('../lib/commands/status');
const { addSkill } = require('../lib/commands/add-skill');
const { runWizard } = require('../lib/ui/wizard');
const { DEFAULT_REGISTRY_PATH } = require('../lib/deploy/registry');
const PROFILES = require('../lib/profiles');

const INFRA_DIR = path.join(__dirname, '..');
const LINE = '-'.repeat(60);

const program = new Command();

program
  .name('claude-scaffold')
  .description('Claude Code infrastructure for ML and AI engineers')
  .version(require('../package.json').version);

program
  .command('init [target-path]')
  .description('Deploy claude-scaffold into a project (interactive if no flags)')
  .option('--profile <name>', `Profile: ${Object.keys(PROFILES).join('|')}`)
  .option('--lang <lang>', 'Language: en|ru', 'en')
  .option('--skills <list>', 'Comma-separated skill names (overrides profile)')
  .option('--ci <profile>', 'CI profile: minimal|fastapi|fastapi-db|ml-heavy')
  .option('--deploy <target>', 'Deploy target: none|yc|vps', 'none')
  .action(async (targetPath, opts) => {
    if (!targetPath && !opts.profile && !opts.skills) {
      const answers = await runWizard();
      targetPath = answers.targetPath;
      opts.profile = answers.profileName;
      opts.skills = answers.skills.join(',');
      opts.lang = answers.lang;
      opts.ci = answers.ciProfile;
      opts.deploy = answers.deployTarget;
    }

    const resolvedTarget = path.resolve(targetPath || process.cwd());

    let skills;
    if (opts.skills) {
      skills = opts.skills.split(',').map(s => s.trim()).filter(Boolean);
    } else if (opts.profile && PROFILES[opts.profile]) {
      skills = PROFILES[opts.profile].skills;
    } else if (opts.profile) {
      console.error(`Unknown profile: ${opts.profile}`);
      console.error(`Available: ${Object.keys(PROFILES).join(', ')}`);
      process.exit(1);
    } else {
      console.error('Specify --profile or --skills, or run without arguments for interactive wizard.');
      process.exit(1);
    }

    console.log(`\n${LINE}`);
    console.log('  claude-scaffold :: Deploy');
    console.log(LINE);
    console.log(`  Target  : ${resolvedTarget}`);
    console.log(`  Skills  : ${skills.join(', ')}`);
    console.log(`  Lang    : ${opts.lang}`);
    console.log(`  CI      : ${opts.ci || 'none'}`);
    console.log(`  Deploy  : ${opts.deploy}`);
    console.log();

    deployCore(INFRA_DIR, resolvedTarget, {
      skills,
      ciProfile: opts.ci || '',
      deployTarget: opts.deploy || 'none',
    });

    console.log(`\n${LINE}`);
    console.log('  Done!');
    console.log(LINE);
    console.log();
    console.log(`  Next steps:`);
    console.log(`  1. Edit ${resolvedTarget}/dev/status.md`);
    console.log(`     Fill in: Business Goal, Current Phase, Next Session Plan`);
    console.log();
    console.log(`  2. Copy and adapt CLAUDE.md:`);
    console.log(`     cp ${INFRA_DIR}/.claude/CLAUDE.md ${resolvedTarget}/.claude/CLAUDE.md`);
    console.log();
    console.log(`  3. Verify hook:`);
    console.log(`     echo '{"prompt":"pyproject.toml ruff"}' | node .claude/hooks/skill-activation-prompt.js`);
    console.log();
  });

program
  .command('update [target-path]')
  .description('Update .claude/ in a registered project (or all with --all)')
  .option('--all', 'Update all registered projects')
  .action((targetPath, opts) => {
    if (opts.all) {
      const result = updateAll(INFRA_DIR, DEFAULT_REGISTRY_PATH);
      console.log(`\nUpdated ${result.updated} repo(s), skipped ${result.skipped} (already up to date).`);
    } else if (targetPath) {
      const resolved = path.resolve(targetPath);
      updateOne(INFRA_DIR, resolved, DEFAULT_REGISTRY_PATH);
      console.log(`\nUpdated: ${resolved}`);
    } else {
      console.error('Specify a target path or use --all');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show all registered projects and their infra version drift')
  .action(() => {
    printStatusReport(INFRA_DIR, DEFAULT_REGISTRY_PATH);
  });

program
  .command('add-skill <skill-name> [target-path]')
  .description('Add a skill to an existing deployed project')
  .action((skillName, targetPath) => {
    const resolved = path.resolve(targetPath || process.cwd());
    addSkill(INFRA_DIR, resolved, skillName);
    console.log(`\nAdded skill '${skillName}' to ${resolved}`);
  });

program.parse(process.argv);
