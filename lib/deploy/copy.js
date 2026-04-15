'use strict';

const fs = require('fs');
const path = require('path');

function buildHooksDefinition(targetDir) {
  const h = path.join(targetDir, '.claude', 'hooks').replace(/\\/g, '/');
  return {
    PreToolUse:       [{ matcher: 'Bash', hooks: [{ type: 'command', command: `node "${h}/session-safety.js"` }, { type: 'command', command: `node "${h}/bash-output-filter.js"` }] }],
    SessionStart:     [{ matcher: '', hooks: [{ type: 'command', command: `node "${h}/session-start.js"` }] }],
    UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: `node "${h}/skill-activation-prompt.js"` }] }],
    PostToolUse:      [{ matcher: '.*', hooks: [{ type: 'command', command: `node "${h}/post-tool-use-tracker.js"` }, { type: 'command', command: `node "${h}/session-checkpoint.js"` }] }],
    Stop:             [{ matcher: '', hooks: [{ type: 'command', command: `node "${h}/python-quality-check.js"` }] }],
  };
}

function copyDirContents(srcDir, dstDir, ext) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (ext && !entry.name.endsWith(ext) && entry.isFile()) continue;
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function copyHooks(infraDir, targetDir) {
  const src = path.join(infraDir, '.claude', 'hooks');
  const dst = path.join(targetDir, '.claude', 'hooks');
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isFile()) {
      fs.copyFileSync(path.join(src, entry.name), path.join(dst, entry.name));
    }
  }
}

function copyAgents(infraDir, targetDir) {
  copyDirContents(
    path.join(infraDir, '.claude', 'agents'),
    path.join(targetDir, '.claude', 'agents'),
    '.md'
  );
}

function copyCommands(infraDir, targetDir) {
  copyDirContents(
    path.join(infraDir, '.claude', 'commands'),
    path.join(targetDir, '.claude', 'commands'),
    '.md'
  );
}

function copySkill(infraDir, targetDir, skillName) {
  const src = path.join(infraDir, '.claude', 'skills', skillName);
  if (!fs.existsSync(src)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  const dst = path.join(targetDir, '.claude', 'skills', skillName);
  copyDirRecursive(src, dst);
}

function generateSkillRules(infraDir, targetDir, skills) {
  const srcPath = path.join(infraDir, '.claude', 'skills', 'skill-rules.json');
  if (!fs.existsSync(srcPath)) {
    throw new Error(`skill-rules.json not found in infra: ${srcPath}`);
  }
  const sourceRules = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

  const filtered = sourceRules.rules.filter(r => skills.includes(r.skill));
  filtered.forEach((rule, i) => { rule.priority = i + 1; });

  const result = { ...sourceRules, rules: filtered };
  const dstPath = path.join(targetDir, '.claude', 'skills', 'skill-rules.json');
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.writeFileSync(dstPath, JSON.stringify(result, null, 2), 'utf8');
  return filtered.length;
}

const DEFAULT_TUNING = Object.freeze({
  effort: 'max',
  adaptiveThinking: 'off',
  thinkingSummaries: 'on',
});

function applyTuningDefaults(existing, tuning) {
  const t = { ...DEFAULT_TUNING, ...(tuning || {}) };
  existing.env = existing.env || {};

  if (existing.env.CLAUDE_CODE_DISABLE_1M_CONTEXT === undefined) {
    existing.env.CLAUDE_CODE_DISABLE_1M_CONTEXT = '1';
  }
  if (t.effort !== 'off' && existing.env.CLAUDE_CODE_EFFORT_LEVEL === undefined) {
    existing.env.CLAUDE_CODE_EFFORT_LEVEL = t.effort;
  }
  if (t.adaptiveThinking !== 'on' && existing.env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING === undefined) {
    existing.env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING = '1';
  }
  if (existing.showClearContextOnPlanAccept === undefined) {
    existing.showClearContextOnPlanAccept = true;
  }
  if (t.thinkingSummaries !== 'off' && existing.showThinkingSummaries === undefined) {
    existing.showThinkingSummaries = true;
  }
  return existing;
}

function applyTuningOverwrite(existing, tuning) {
  const t = tuning || {};
  existing.env = existing.env || {};

  if (t.effort === 'off') {
    delete existing.env.CLAUDE_CODE_EFFORT_LEVEL;
  } else if (t.effort) {
    existing.env.CLAUDE_CODE_EFFORT_LEVEL = t.effort;
  }

  if (t.adaptiveThinking === 'on') {
    delete existing.env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING;
  } else if (t.adaptiveThinking === 'off') {
    existing.env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING = '1';
  }

  if (t.thinkingSummaries === 'off') {
    existing.showThinkingSummaries = false;
  } else if (t.thinkingSummaries === 'on') {
    existing.showThinkingSummaries = true;
  }
  return existing;
}

function deploySettings(targetDir, tuning) {
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  let existing = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      existing = {};
    }
  }
  const newHooksDef = buildHooksDefinition(targetDir);
  existing.hooks = existing.hooks || {};
  for (const [event, scaffoldEntries] of Object.entries(newHooksDef)) {
    const scaffoldMatchers = new Set(scaffoldEntries.map(e => e.matcher));
    const userEntries = (existing.hooks[event] || []).filter(e => !scaffoldMatchers.has(e.matcher));
    existing.hooks[event] = [...userEntries, ...scaffoldEntries];
  }

  applyTuningDefaults(existing, tuning);

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

function ensureGitignore(targetDir) {
  const gitignorePath = path.join(targetDir, '.gitignore');
  const entry = '\n# Claude Code — local tool, never commit\n.claude/\n';
  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, 'utf8');
    if (!existing.includes('.claude/')) {
      fs.appendFileSync(gitignorePath, entry, 'utf8');
    }
  } else {
    fs.writeFileSync(gitignorePath, entry, 'utf8');
  }
}

function createDevStatus(infraDir, targetDir) {
  const statusDst = path.join(targetDir, 'dev', 'status.md');
  if (!fs.existsSync(statusDst)) {
    const statusSrc = path.join(infraDir, 'templates', 'status.md');
    fs.mkdirSync(path.dirname(statusDst), { recursive: true });
    fs.copyFileSync(statusSrc, statusDst);
    return true;
  }
  return false;
}

function createAgentExtensionsDir(targetDir) {
  const extDir = path.join(targetDir, '.claude', 'agent-extensions');
  fs.mkdirSync(extDir, { recursive: true });
  const gitkeep = path.join(extDir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, '', 'utf8');
}

function mergeAgentExtensions(targetDir) {
  const agentsDir = path.join(targetDir, '.claude', 'agents');
  const extDir = path.join(targetDir, '.claude', 'agent-extensions');
  if (!fs.existsSync(extDir)) return 0;
  let merged = 0;
  for (const file of fs.readdirSync(extDir).filter(f => f.endsWith('.md'))) {
    const basePath = path.join(agentsDir, file);
    const extPath = path.join(extDir, file);
    const ext = fs.readFileSync(extPath, 'utf8');
    if (fs.existsSync(basePath)) {
      const base = fs.readFileSync(basePath, 'utf8');
      if (base.includes('## Project-Specific Extensions')) continue;
      fs.writeFileSync(basePath, base + '\n\n---\n\n## Project-Specific Extensions\n\n' + ext, 'utf8');
    } else {
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.copyFileSync(extPath, basePath);
    }
    merged++;
  }
  return merged;
}

function copyPitfalls(infraDir, targetDir) {
  const dst = path.join(targetDir, '.claude', 'PITFALLS.md');
  if (fs.existsSync(dst)) return false;
  const src = path.join(infraDir, 'templates', 'PITFALLS.md');
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return true;
}

function copyTemplateToRoot(infraDir, targetDir, filename) {
  const dst = path.join(targetDir, filename);
  if (fs.existsSync(dst)) return false;
  const src = path.join(infraDir, 'templates', filename);
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dst);
  return true;
}

module.exports = {
  copyHooks,
  copyAgents,
  copyCommands,
  copySkill,
  generateSkillRules,
  deploySettings,
  applyTuningDefaults,
  applyTuningOverwrite,
  DEFAULT_TUNING,
  ensureGitignore,
  createDevStatus,
  copyDirRecursive,
  buildHooksDefinition,
  createAgentExtensionsDir,
  mergeAgentExtensions,
  copyPitfalls,
  copyTemplateToRoot,
};
