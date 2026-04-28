'use strict';

const fs = require('fs');
const path = require('path');
const { parseSimpleYaml } = require('../yaml-parser');

function getDepsPath(cwd) {
  return path.join(cwd, 'deps.yaml');
}

function loadDeps(cwd) {
  const p = getDepsPath(cwd);
  if (!fs.existsSync(p)) return null;
  return parseSimpleYaml(fs.readFileSync(p, 'utf8'));
}

function serializeDeps(deps) {
  const lines = [];
  if (deps.project) lines.push(`project: ${deps.project}`);
  lines.push('');
  if (Array.isArray(deps.depends_on)) {
    lines.push('depends_on:');
    for (const d of deps.depends_on) {
      lines.push(`  - repo: ${d.repo}`);
      if (d.type) lines.push(`    type: ${d.type}`);
      if (d.description) lines.push(`    description: "${d.description}"`);
    }
  }
  lines.push('');
  if (Array.isArray(deps.blockers) && deps.blockers.length > 0) {
    lines.push('blockers:');
    for (const b of deps.blockers) {
      lines.push(`  - id: ${b.id}`);
      if (b.description) lines.push(`    description: "${b.description}"`);
      lines.push(`    status: ${b.status || 'open'}`);
      if (b.since && b.since !== 'undefined') lines.push(`    since: "${b.since}"`);
    }
  }
  return lines.join('\n') + '\n';
}

function saveDeps(cwd, deps) {
  fs.writeFileSync(getDepsPath(cwd), serializeDeps(deps), 'utf8');
}

function runDepsStatus(cwd) {
  const deps = loadDeps(cwd);
  if (!deps) {
    console.log('No deps.yaml found. Create one with: npx claude-scaffold deps add <repo>');
    return;
  }
  console.log(`\nProject: ${deps.project || '(unnamed)'}\n`);
  const dependsOn = Array.isArray(deps.depends_on) ? deps.depends_on.filter(d => typeof d === 'object') : [];
  if (dependsOn.length > 0) {
    console.log('Dependencies:');
    for (const d of dependsOn) {
      console.log(`  ${d.repo} (${d.type || 'unknown'}) — ${d.description || ''}`);
    }
  } else {
    console.log('No dependencies declared.');
  }
  const blockers = Array.isArray(deps.blockers) ? deps.blockers.filter(b => typeof b === 'object') : [];
  if (blockers.length > 0) {
    const open = blockers.filter(b => b.status === 'open');
    const resolved = blockers.filter(b => b.status === 'resolved');
    console.log(`\nBlockers: ${open.length} open, ${resolved.length} resolved`);
    for (const b of blockers) {
      const marker = b.status === 'open' ? 'OPEN' : 'resolved';
      console.log(`  [${b.id}] [${marker}] ${b.description || ''} (since ${b.since || '?'})`);
    }
  }
}

const VALID_BLOCKER_STATUSES = ['open', 'resolved', 'wontfix'];

function validateRepoName(repo) {
  if (!repo || typeof repo !== 'string' || !repo.trim()) {
    throw new Error('Repo name is required');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(repo)) {
    throw new Error(`Invalid repo name: "${repo}" — must be alphanumeric with hyphens/underscores`);
  }
}

function runDepsUpdateBlocker(cwd, id, opts) {
  const deps = loadDeps(cwd);
  if (!deps) { console.error('No deps.yaml found.'); return; }
  const status = opts.status || 'resolved';
  if (!VALID_BLOCKER_STATUSES.includes(status)) {
    console.error(`Invalid status: "${status}". Must be one of: ${VALID_BLOCKER_STATUSES.join(', ')}`);
    return;
  }
  const blockers = Array.isArray(deps.blockers) ? deps.blockers : [];
  const blocker = blockers.find(b => typeof b === 'object' && b.id === id);
  if (!blocker) {
    console.error(`Blocker "${id}" not found.`);
    return;
  }
  blocker.status = status;
  saveDeps(cwd, deps);
  console.log(`Blocker ${id} updated to: ${blocker.status}`);
}

function runDepsAdd(cwd, repo, opts) {
  try { validateRepoName(repo); } catch (e) { console.error(`Error: ${e.message}`); return; }
  let deps = loadDeps(cwd);
  if (!deps) {
    deps = { project: path.basename(cwd), depends_on: [], blockers: [] };
  }
  if (!Array.isArray(deps.depends_on)) deps.depends_on = [];
  const existing = deps.depends_on.find(d => typeof d === 'object' && d.repo === repo);
  if (existing) {
    console.log(`Dependency "${repo}" already exists. Updating type.`);
    existing.type = opts.type || existing.type;
    existing.description = opts.description || existing.description;
  } else {
    deps.depends_on.push({ repo, type: opts.type || 'knowledge', description: opts.description || '' });
  }
  saveDeps(cwd, deps);
  console.log(`Dependency "${repo}" added (type: ${opts.type || 'knowledge'}).`);
}

function runDepsRemove(cwd, repo) {
  const deps = loadDeps(cwd);
  if (!deps) { console.error('No deps.yaml found.'); return; }
  if (!Array.isArray(deps.depends_on)) { console.error('No dependencies declared.'); return; }
  const idx = deps.depends_on.findIndex(d => typeof d === 'object' && d.repo === repo);
  if (idx === -1) {
    console.error(`Dependency "${repo}" not found.`);
    return;
  }
  deps.depends_on.splice(idx, 1);
  saveDeps(cwd, deps);
  console.log(`Dependency "${repo}" removed.`);
}

module.exports = { runDepsStatus, runDepsUpdateBlocker, runDepsAdd, runDepsRemove, loadDeps, saveDeps, serializeDeps };
