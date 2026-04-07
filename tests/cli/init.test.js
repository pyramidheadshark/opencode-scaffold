'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let registryPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-init-'));
  registryPath = path.join(os.tmpdir(), `cs-test-init-reg-${Date.now()}.json`);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
});

const INFRA_DIR = path.join(__dirname, '..', '..');
const { deployCore, PROFILE_RESULT } = require('../../lib/commands/init');
const { generateSkillRules } = require('../../lib/deploy/copy');

describe('init — deployCore', () => {
  test('creates .claude/hooks/ directory', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks'))).toBe(true);
  });

  test('creates .claude/agents/ directory', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'agents'))).toBe(true);
  });

  test('creates .claude/commands/ directory', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'commands'))).toBe(true);
  });

  test('creates .claude/skills/ with selected skill', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(
      fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'python-project-standards'))
    ).toBe(true);
  });

  test('does not copy unselected skills', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(
      fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'fastapi-patterns'))
    ).toBe(false);
  });

  test('generates skill-rules.json with only selected skills', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards', 'fastapi-patterns'], registryPath });
    const rulesPath = path.join(tmpDir, '.claude', 'skills', 'skill-rules.json');
    expect(fs.existsSync(rulesPath)).toBe(true);
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const skillNames = rules.rules.map(r => r.skill);
    expect(skillNames).toContain('python-project-standards');
    expect(skillNames).toContain('fastapi-patterns');
    expect(skillNames).not.toContain('rag-vector-db');
  });

  test('creates .claude/settings.json with hooks', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.UserPromptSubmit).toBeDefined();
  });

  test('creates dev/status.md from template', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(fs.existsSync(path.join(tmpDir, 'dev', 'status.md'))).toBe(true);
  });

  test('does not overwrite existing dev/status.md', () => {
    const devDir = path.join(tmpDir, 'dev');
    fs.mkdirSync(devDir, { recursive: true });
    const statusPath = path.join(devDir, 'status.md');
    fs.writeFileSync(statusPath, '# Existing status', 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(fs.readFileSync(statusPath, 'utf8')).toBe('# Existing status');
  });

  test('adds .claude/ to new .gitignore', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.claude/');
  });

  test('adds .claude/ to existing .gitignore that lacks it', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n', 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.claude/');
    expect(gitignore).toContain('node_modules/');
  });

  test('does not duplicate .claude/ in gitignore if already present', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.claude/\nnode_modules/\n', 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
    const count = (gitignore.match(/\.claude\//g) || []).length;
    expect(count).toBe(1);
  });

  test('writes infra-version file', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const versionFile = path.join(tmpDir, '.claude', 'infra-version');
    expect(fs.existsSync(versionFile)).toBe(true);
    const sha = fs.readFileSync(versionFile, 'utf8').trim();
    expect(sha.length).toBeGreaterThan(0);
  });

  test('preserves existing mcpServers in settings.json', () => {
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ mcpServers: { myServer: {} } }), 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings.mcpServers).toBeDefined();
    expect(settings.mcpServers.myServer).toBeDefined();
  });

  test('settings.json hooks use node commands (not bash)', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8')
    );
    const postToolCmd = settings.hooks.PostToolUse[0].hooks[0].command;
    const stopCmd = settings.hooks.Stop[0].hooks[0].command;
    expect(postToolCmd).toMatch(/^node "/);
    expect(postToolCmd).toMatch(/\.js"$/);
    expect(stopCmd).toMatch(/^node "/);
    expect(stopCmd).toMatch(/\.js"$/);
    expect(postToolCmd).not.toMatch(/bash/);
    expect(stopCmd).not.toMatch(/bash/);
  });

  test('PostToolUse has exactly 2 hooks in correct order', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const hooks = settings.hooks.PostToolUse[0].hooks;
    expect(hooks).toHaveLength(2);
    expect(hooks[0].command).toContain('post-tool-use-tracker.js');
    expect(hooks[1].command).toContain('session-checkpoint.js');
  });

  test('PreToolUse has exactly 2 hooks (session-safety + bash-output-filter)', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8')
    );
    expect(settings.hooks.PreToolUse).toBeDefined();
    const hooks = settings.hooks.PreToolUse[0].hooks;
    expect(hooks).toHaveLength(2);
    expect(hooks[0].command).toContain('session-safety.js');
    expect(hooks[1].command).toContain('bash-output-filter.js');
  });

  test('PreToolUse matcher is Bash', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8')
    );
    expect(settings.hooks.PreToolUse[0].matcher).toBe('Bash');
  });

  test('lang ru writes project-config.json with lang:ru', () => {
    deployCore(INFRA_DIR, tmpDir, {
      skills: ['python-project-standards'],
      lang: 'ru',
      registryPath,
    });
    const configPath = path.join(tmpDir, '.claude', 'project-config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.lang).toBe('ru');
    expect(config.session_count).toBe(0);
  });

  test('lang en (default) does NOT write project-config.json', () => {
    deployCore(INFRA_DIR, tmpDir, {
      skills: ['python-project-standards'],
      lang: 'en',
      registryPath,
    });
    const configPath = path.join(tmpDir, '.claude', 'project-config.json');
    expect(fs.existsSync(configPath)).toBe(false);
  });

  test('copies profile CLAUDE.md template for known profile + lang', () => {
    deployCore(INFRA_DIR, tmpDir, {
      skills: ['python-project-standards'],
      profile: 'ml-engineer',
      lang: 'en',
      registryPath,
    });
    const claudeMd = path.join(tmpDir, '.claude', 'CLAUDE.md');
    expect(fs.existsSync(claudeMd)).toBe(true);
    const content = fs.readFileSync(claudeMd, 'utf8');
    expect(content).toContain('ML Engineer');
  });

  test('copies RU profile CLAUDE.md when lang is ru', () => {
    deployCore(INFRA_DIR, tmpDir, {
      skills: ['python-project-standards'],
      profile: 'ml-engineer',
      lang: 'ru',
      registryPath,
    });
    const claudeMd = path.join(tmpDir, '.claude', 'CLAUDE.md');
    expect(fs.existsSync(claudeMd)).toBe(true);
    const content = fs.readFileSync(claudeMd, 'utf8');
    expect(content).toContain('ML Engineer');
    expect(content).toContain('Профиль');
  });

  test('deployCore preserves user custom hook events in settings.json', () => {
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: { PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: 'my-hook' }] }] },
    }), 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings.hooks.PreToolUse).toBeDefined();
    expect(settings.hooks.UserPromptSubmit).toBeDefined();
    // User's custom hook must be preserved alongside scaffold hooks
    const customEntry = settings.hooks.PreToolUse.find(e => e.matcher === '.*');
    expect(customEntry).toBeDefined();
    expect(customEntry.hooks[0].command).toBe('my-hook');
    // Scaffold Bash hooks must also be present
    const scaffoldEntry = settings.hooks.PreToolUse.find(e => e.matcher === 'Bash');
    expect(scaffoldEntry).toBeDefined();
    expect(scaffoldEntry.hooks.some(h => h.command.includes('session-safety.js'))).toBe(true);
  });

  test('re-deploy does not duplicate scaffold hooks', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8')
    );
    const preToolUse = settings.hooks.PreToolUse;
    const bashEntries = preToolUse.filter(e => e.matcher === 'Bash');
    expect(bashEntries).toHaveLength(1);
  });

  test('copyHooks deploys filter_rules.json alongside hook files', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const filterRulesPath = path.join(tmpDir, '.claude', 'hooks', 'filter_rules.json');
    expect(fs.existsSync(filterRulesPath)).toBe(true);
    const rules = JSON.parse(fs.readFileSync(filterRulesPath, 'utf8'));
    expect(Array.isArray(rules.rules)).toBe(true);
    expect(rules.rules.length).toBeGreaterThan(0);
  });

  test('generateSkillRules throws if skill-rules.json missing from infra', () => {
    const fakeInfra = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fake-infra-init-'));
    fs.mkdirSync(path.join(fakeInfra, '.claude', 'skills'), { recursive: true });
    try {
      expect(() => generateSkillRules(fakeInfra, tmpDir, ['python-project-standards']))
        .toThrow('skill-rules.json not found');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('copyProfileTemplate returns NOT_FOUND for unknown profile', () => {
    const { copyProfileTemplate } = require('../../lib/commands/init');
    const result = copyProfileTemplate(INFRA_DIR, tmpDir, 'nonexistent-profile', 'en');
    expect(result).toBe(PROFILE_RESULT.NOT_FOUND);
  });

  test('copyProfileTemplate returns SKIPPED when CLAUDE.md already exists', () => {
    const { copyProfileTemplate } = require('../../lib/commands/init');
    const claudeMd = path.join(tmpDir, '.claude', 'CLAUDE.md');
    fs.mkdirSync(path.dirname(claudeMd), { recursive: true });
    fs.writeFileSync(claudeMd, '# existing', 'utf8');
    const result = copyProfileTemplate(INFRA_DIR, tmpDir, 'ml-engineer', 'en');
    expect(result).toBe(PROFILE_RESULT.SKIPPED);
    expect(fs.readFileSync(claudeMd, 'utf8')).toBe('# existing');
  });

  test('dry-run does not write any files to target', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], dryRun: true, registryPath });
    expect(fs.existsSync(path.join(tmpDir, '.claude'))).toBe(false);
  });

  test('dry-run prints plan to stdout', () => {
    const chunks = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...args) => { chunks.push(chunk); return origWrite(chunk, ...args); };
    try {
      deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards', 'fastapi-patterns'], dryRun: true, registryPath });
    } finally {
      process.stdout.write = origWrite;
    }
    const output = chunks.join('');
    expect(output).toContain('[dry-run]');
    expect(output).toContain('python-project-standards');
    expect(output).toContain('fastapi-patterns');
    expect(output).toContain('Register in deployed-repos.json');
  });

  test('dry-run with profile includes CLAUDE.md line in plan', () => {
    const chunks = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...args) => { chunks.push(chunk); return origWrite(chunk, ...args); };
    try {
      deployCore(INFRA_DIR, tmpDir, {
        skills: ['python-project-standards'],
        profile: 'ml-engineer',
        lang: 'ru',
        dryRun: true,
        registryPath,
      });
    } finally {
      process.stdout.write = origWrite;
    }
    const output = chunks.join('');
    expect(output).toContain('CLAUDE.md');
    expect(output).toContain('ml-engineer');
    expect(output).toContain('ru');
  });

  test('settings.json hook commands use absolute paths (not relative .claude/)', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8')
    );
    const cmds = [
      settings.hooks.SessionStart[0].hooks[0].command,
      settings.hooks.UserPromptSubmit[0].hooks[0].command,
      settings.hooks.PostToolUse[0].hooks[0].command,
      settings.hooks.Stop[0].hooks[0].command,
    ];
    for (const cmd of cmds) {
      expect(cmd).not.toMatch(/^node \.claude\//);
      expect(cmd).toMatch(/^node "/);
      expect(cmd).toMatch(/\.js"$/);
    }
    expect(cmds[0]).toContain('session-start.js');
    expect(cmds[1]).toContain('skill-activation-prompt.js');
    expect(cmds[2]).toContain('post-tool-use-tracker.js');
    expect(cmds[3]).toContain('python-quality-check.js');
  });

  test('buildHooksDefinition quotes path — spaces in targetDir are safe', () => {
    const { buildHooksDefinition } = require('../../lib/deploy/copy');
    const fakeTarget = '/Users/John Doe/Repos/my project';
    const hooks = buildHooksDefinition(fakeTarget);

    const cmds = [
      hooks.SessionStart[0].hooks[0].command,
      hooks.UserPromptSubmit[0].hooks[0].command,
      hooks.PostToolUse[0].hooks[0].command,
      hooks.PostToolUse[0].hooks[1].command,
      hooks.Stop[0].hooks[0].command,
    ];

    for (const cmd of cmds) {
      expect(cmd).toMatch(/^node "/);
      expect(cmd).toMatch(/\.js"$/);
      expect(cmd).toContain('John Doe');
      expect(cmd).toContain('my project');
    }

    expect(cmds[0]).toContain('session-start.js');
    expect(cmds[1]).toContain('skill-activation-prompt.js');
    expect(cmds[2]).toContain('post-tool-use-tracker.js');
    expect(cmds[3]).toContain('session-checkpoint.js');
    expect(cmds[4]).toContain('python-quality-check.js');
  });

  test('deployCore with profile=hub copies expected skills', () => {
    const PROFILES = require('../../lib/profiles');
    const hubSkills = PROFILES.hub.skills;
    deployCore(INFRA_DIR, tmpDir, { skills: hubSkills, profile: 'hub', registryPath });
    const rulesPath = path.join(tmpDir, '.claude', 'skills', 'skill-rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const skillNames = rules.rules.map(r => r.skill);
    expect(skillNames).toContain('python-project-standards');
    expect(skillNames).toContain('critical-analysis');
    expect(skillNames).toContain('rag-vector-db');
    expect(skillNames).toContain('prompt-engineering');
  });

  test('deployCore with profile=task-hub copies expected skills', () => {
    const PROFILES = require('../../lib/profiles');
    const taskHubSkills = PROFILES['task-hub'].skills;
    deployCore(INFRA_DIR, tmpDir, { skills: taskHubSkills, profile: 'task-hub', registryPath });
    const rulesPath = path.join(tmpDir, '.claude', 'skills', 'skill-rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const skillNames = rules.rules.map(r => r.skill);
    expect(skillNames).toContain('python-project-standards');
    expect(skillNames).toContain('critical-analysis');
    expect(skillNames).toHaveLength(2);
  });

  test('deployCore creates agent-extensions directory with .gitkeep', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const extDir = path.join(tmpDir, '.claude', 'agent-extensions');
    expect(fs.existsSync(extDir)).toBe(true);
    expect(fs.existsSync(path.join(extDir, '.gitkeep'))).toBe(true);
  });

  test('deployCore copies PITFALLS.md template', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const pitfalls = path.join(tmpDir, '.claude', 'PITFALLS.md');
    expect(fs.existsSync(pitfalls)).toBe(true);
    const content = fs.readFileSync(pitfalls, 'utf8');
    expect(content).toContain('Known Pitfalls');
  });

  test('deployCore does not overwrite existing PITFALLS.md', () => {
    const pitfalls = path.join(tmpDir, '.claude', 'PITFALLS.md');
    fs.mkdirSync(path.dirname(pitfalls), { recursive: true });
    fs.writeFileSync(pitfalls, '# My custom pitfalls', 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    expect(fs.readFileSync(pitfalls, 'utf8')).toBe('# My custom pitfalls');
  });

  test('settings.json gets DISABLE_1M_CONTEXT env var on fresh deploy', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8')
    );
    expect(settings.env).toBeDefined();
    expect(settings.env.CLAUDE_CODE_DISABLE_1M_CONTEXT).toBe('1');
  });

  test('settings.json does not overwrite existing DISABLE_1M_CONTEXT', () => {
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ env: { CLAUDE_CODE_DISABLE_1M_CONTEXT: '0' } }), 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings.env.CLAUDE_CODE_DISABLE_1M_CONTEXT).toBe('0');
  });

  test('settings.json gets showClearContextOnPlanAccept on fresh deploy', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8')
    );
    expect(settings.showClearContextOnPlanAccept).toBe(true);
  });

  test('settings.json does not overwrite explicit showClearContextOnPlanAccept: false', () => {
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ showClearContextOnPlanAccept: false }), 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings.showClearContextOnPlanAccept).toBe(false);
  });

  test('deployCore overwrites scaffold hook events with current definition', () => {
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: { UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: 'node old-hook.js' }] }] },
    }), 'utf8');
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const cmd = settings.hooks.UserPromptSubmit[0].hooks[0].command;
    expect(cmd).toContain('skill-activation-prompt.js');
    expect(cmd).not.toContain('old-hook.js');
  });
});
