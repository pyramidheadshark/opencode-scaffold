#!/usr/bin/env node
'use strict';

const path = require('path');
const { Command } = require('commander');
const { deployCore } = require('../lib/commands/init');
const { updateOne, updateAll } = require('../lib/commands/update');
const { printStatusReport } = require('../lib/commands/status');
const { addSkill } = require('../lib/commands/add-skill');
const { runMetrics } = require('../lib/commands/metrics');
const { run: runSessionLogs } = require('../lib/commands/session-logs');
const { runWizard } = require('../lib/ui/wizard');
const { listOrgProfiles, updateOrgProfile, loadOrgProfile } = require('../lib/commands/org-profile');
const { DEFAULT_REGISTRY_PATH } = require('../lib/deploy/registry');
const { runRegistrySearch, runRegistryInstall, runRegistryList, runRegistryUpdate, runRegistryAddSource } = require('../lib/commands/registry');
const { runDepsStatus, runDepsUpdateBlocker, runDepsAdd, runDepsRemove } = require('../lib/commands/deps');
const { runTune } = require('../lib/commands/tune');
const PROFILES = require('../lib/profiles');

function buildTuning(opts) {
  const tuning = {};
  if (opts.effort !== undefined) tuning.effort = opts.effort;
  if (opts.adaptiveThinking !== undefined) tuning.adaptiveThinking = opts.adaptiveThinking;
  if (opts.thinkingSummaries !== undefined) tuning.thinkingSummaries = opts.thinkingSummaries;
  return tuning;
}

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
  .option('--dry-run', 'Preview what will be deployed without writing files')
  .option('--org-profile <org>', 'Org profile name (e.g. techcon-ml)')
  .option('--org-type <type>', 'Project type within org (required with --org-profile)')
  .option('--effort <level>', 'Thinking effort: max|high|medium|off (default: max)')
  .option('--adaptive-thinking <mode>', 'Adaptive thinking: on|off (default: off — opt-out)')
  .option('--thinking-summaries <mode>', 'Thinking summaries: on|off (default: on)')
  .action(async (targetPath, opts) => {
    if (opts.orgProfile && !opts.orgType) {
      console.error('Error: --org-type is required with --org-profile (see list-org-profiles)');
      process.exit(1);
    }
    if (opts.orgProfile && opts.orgType) {
      try {
        const profile = loadOrgProfile(INFRA_DIR, opts.orgProfile);
        if (!profile.project_types || !profile.project_types[opts.orgType]) {
          console.error(`Error: unknown type '${opts.orgType}' for org '${opts.orgProfile}'`);
          console.error(`Available types: ${Object.keys(profile.project_types || {}).join(', ')}`);
          process.exit(1);
        }
      } catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
      }
    }

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
    if (opts.orgProfile) {
      console.log(`  Org     : ${opts.orgProfile}/${opts.orgType}`);
    }
    console.log();

    deployCore(INFRA_DIR, resolvedTarget, {
      skills,
      profile: opts.profile || '',
      lang: opts.lang || 'en',
      ciProfile: opts.ci || '',
      deployTarget: opts.deploy || 'none',
      dryRun: !!opts.dryRun,
      orgProfile: opts.orgProfile || '',
      orgType: opts.orgType || '',
      tuning: buildTuning(opts),
    });

    if (opts.dryRun) return;

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
  .option('--effort <level>', 'Thinking effort: max|high|medium|off')
  .option('--adaptive-thinking <mode>', 'Adaptive thinking: on|off')
  .option('--thinking-summaries <mode>', 'Thinking summaries: on|off')
  .action((targetPath, opts) => {
    const tuning = buildTuning(opts);
    if (opts.all) {
      const result = updateAll(INFRA_DIR, DEFAULT_REGISTRY_PATH, tuning);
      console.log(`\nUpdated ${result.updated} repo(s), skipped ${result.skipped} (already up to date).`);
    } else if (targetPath) {
      const resolved = path.resolve(targetPath);
      updateOne(INFRA_DIR, resolved, DEFAULT_REGISTRY_PATH, tuning);
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

program
  .command('metrics')
  .description('Show skill load frequency report from .claude/logs/skill-metrics.jsonl')
  .action(() => {
    runMetrics(process.cwd());
  });

program
  .command('session-logs [target-path]')
  .description('View session audit logs from .claude/logs/sessions/')
  .option('--list', 'List available sessions')
  .option('--session <id>', 'Show events for a specific session ID')
  .option('--tail <n>', 'Show last N events', parseInt)
  .action((targetPath, opts) => {
    const resolved = path.resolve(targetPath || process.cwd());
    runSessionLogs(resolved, opts);
  });

program
  .command('use <model>')
  .description('Switch active model profile (sonnet, haiku, opus, gemini-flash, or preset: executor, architect, critic)')
  .option('--show-env', 'Print env vars to stdout instead of writing file')
  .action((model, opts) => require('../lib/commands/model-router').use(model, opts));

program
  .command('install-aliases')
  .description('Install claude-sonnet, claude-haiku, claude-opus, claude-gemini-flash shell aliases')
  .action(() => require('../lib/commands/model-router').installAliases());

program
  .command('new-session [description]')
  .description('Create a session contract in dev/active/session-YYYY-MM-DD.md')
  .action((description) => require('../lib/commands/new-session').newSession(description));

program
  .command('discover [query]')
  .description('Detect project stack and find matching skills in the registry')
  .option('--install', 'Auto-install matching skills without prompting')
  .option('--json', 'Output results as JSON')
  .action((query, opts) => {
    const { runDiscover } = require('../lib/commands/discover');
    runDiscover(INFRA_DIR, process.cwd(), { query, ...opts });
  });

program
  .command('list-org-profiles')
  .description('List available org profiles and their project types')
  .action(() => {
    const profiles = listOrgProfiles(INFRA_DIR);
    if (profiles.length === 0) {
      console.log('No org profiles found. Create org-profiles/<org-name>/ in scaffold directory.');
      return;
    }
    for (const { org, description, types } of profiles) {
      console.log(`\n${org}  —  ${description}`);
      for (const { name, description: typeDesc } of types) {
        console.log(`  ${name.padEnd(14)} ${typeDesc}`);
      }
    }
    console.log();
  });

program
  .command('update-org-profile')
  .description('Update CLAUDE.md from org profile templates in registered repos')
  .requiredOption('--org <name>', 'Org profile name (e.g. techcon-ml)')
  .option('--repos <paths>', 'Comma-separated repo paths (overrides repos.json)')
  .option('--lang <lang>', 'Language for templates: en|ru', 'en')
  .action((opts) => {
    let repos = null;
    if (opts.repos) {
      repos = opts.repos.split(',').map(p => p.trim()).filter(Boolean).map(p => ({
        path: path.resolve(p),
        name: path.basename(p),
        type: null,
      }));
    }
    let result;
    try {
      result = updateOrgProfile(INFRA_DIR, opts.org, { repos, lang: opts.lang });
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    console.log(`\n${LINE}`);
    console.log('  update-org-profile :: Result');
    console.log(LINE);
    if (result.updated.length > 0) {
      console.log(`  Updated (${result.updated.length}): ${result.updated.join(', ')}`);
    }
    if (result.skipped.length > 0) {
      for (const s of result.skipped) {
        console.log(`  Skipped: ${s.name} — ${s.reason}`);
      }
    }
    if (result.errors.length > 0) {
      for (const e of result.errors) {
        console.log(`  Error:   ${e.name} — ${e.error}`);
      }
    }
    console.log();
  });

const deps = program.command('deps').description('Cross-repo dependency management');

deps
  .command('status')
  .description('Show dependency graph and blockers')
  .action(() => {
    runDepsStatus(process.cwd());
  });

deps
  .command('update-blocker <id>')
  .description('Update blocker status')
  .requiredOption('--status <status>', 'New status (open, resolved)')
  .action((id, opts) => {
    runDepsUpdateBlocker(process.cwd(), id, opts);
  });

deps
  .command('add <repo>')
  .description('Add a dependency')
  .option('--type <type>', 'Dependency type', 'knowledge')
  .option('--description <desc>', 'Description')
  .action((repo, opts) => {
    runDepsAdd(process.cwd(), repo, opts);
  });

deps
  .command('remove <repo>')
  .description('Remove a dependency')
  .action((repo) => {
    runDepsRemove(process.cwd(), repo);
  });

const registry = program.command('registry').description('Skill registry: search, install, and manage skill sources');

registry
  .command('search <query>')
  .description('Search registry for skills by name, description, or tags')
  .action(async (query) => {
    try { await runRegistrySearch(INFRA_DIR, query); }
    catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }
  });

registry
  .command('install <skill>')
  .description('Install a skill from the registry into current project')
  .option('--force', 'Install community skills without confirmation')
  .action(async (skill, opts) => {
    try { await runRegistryInstall(INFRA_DIR, process.cwd(), skill, opts); }
    catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }
  });

registry
  .command('list')
  .description('List all skills available in the registry cache')
  .action(async () => {
    try { await runRegistryList(INFRA_DIR); }
    catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }
  });

registry
  .command('update')
  .description('Refresh the local registry cache from all sources')
  .action(async () => {
    try { await runRegistryUpdate(INFRA_DIR); }
    catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }
  });

registry
  .command('add-source <name> <url>')
  .description('Add an external skill source to the registry')
  .option('--trust <level>', 'Trust level: verified, community, untrusted', 'community')
  .action(async (name, url, opts) => {
    try { await runRegistryAddSource(INFRA_DIR, name, url, opts); }
    catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }
  });

program
  .command('tune [target-path]')
  .description('Overwrite thinking/effort settings in an existing .claude/settings.json')
  .option('--effort <level>', 'Thinking effort: max|high|medium|off (off deletes the key)')
  .option('--adaptive-thinking <mode>', 'Adaptive thinking: on|off (on deletes the DISABLE key)')
  .option('--thinking-summaries <mode>', 'Thinking summaries: on|off')
  .action((targetPath, opts) => {
    const resolved = path.resolve(targetPath || process.cwd());
    const tuning = buildTuning(opts);
    if (Object.keys(tuning).length === 0) {
      console.error('Specify at least one of: --effort, --adaptive-thinking, --thinking-summaries');
      process.exit(1);
    }
    const result = runTune(resolved, tuning);
    console.log(`\nTuned: ${result.settingsPath}`);
    if (result.env.CLAUDE_CODE_EFFORT_LEVEL !== undefined) {
      console.log(`  CLAUDE_CODE_EFFORT_LEVEL = ${result.env.CLAUDE_CODE_EFFORT_LEVEL}`);
    }
    if (result.env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING !== undefined) {
      console.log(`  CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING = ${result.env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING}`);
    }
    if (result.showThinkingSummaries !== undefined) {
      console.log(`  showThinkingSummaries = ${result.showThinkingSummaries}`);
    }
  });

program.parse(process.argv);
