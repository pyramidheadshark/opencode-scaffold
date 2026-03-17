'use strict';

const fs = require('fs');
const path = require('path');

function buildHooksDefinition(targetDir) {
  const h = path.join(targetDir, '.claude', 'hooks').replace(/\\/g, '/');
  return {
    SessionStart:     [{ matcher: '', hooks: [{ type: 'command', command: `node ${h}/session-start.js` }] }],
    UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: `node ${h}/skill-activation-prompt.js` }] }],
    PostToolUse:      [{ matcher: '.*', hooks: [{ type: 'command', command: `node ${h}/post-tool-use-tracker.js` }, { type: 'command', command: `node ${h}/session-checkpoint.js` }] }],
    Stop:             [{ matcher: '', hooks: [{ type: 'command', command: `node ${h}/python-quality-check.js` }] }],
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

function deploySettings(targetDir) {
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  let existing = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      existing = {};
    }
  }
  existing.hooks = { ...existing.hooks, ...buildHooksDefinition(targetDir) };
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

module.exports = {
  copyHooks,
  copyAgents,
  copyCommands,
  copySkill,
  generateSkillRules,
  deploySettings,
  ensureGitignore,
  createDevStatus,
  copyDirRecursive,
  buildHooksDefinition,
};
