'use strict';
const fs = require('fs');
const path = require('path');

const STACK_DETECTORS = [
  { check: (cwd) => readJsonKey(cwd, 'package.json', 'dependencies.react'), tags: ['react', 'frontend'] },
  { check: (cwd) => readJsonKey(cwd, 'package.json', 'dependencies.vue'), tags: ['vue', 'frontend'] },
  { check: (cwd) => readJsonKey(cwd, 'package.json', 'dependencies.svelte'), tags: ['svelte', 'frontend'] },
  { check: (cwd) => readJsonKey(cwd, 'package.json', 'dependencies.next') || readJsonKey(cwd, 'package.json', 'devDependencies.next'), tags: ['nextjs', 'frontend', 'react'] },
  { check: (cwd) => readJsonKey(cwd, 'package.json', 'dependencies.express'), tags: ['express', 'backend', 'nodejs'] },
  { check: (cwd) => readJsonKey(cwd, 'package.json', 'devDependencies.typescript') || readJsonKey(cwd, 'package.json', 'dependencies.typescript'), tags: ['typescript'] },
  { check: (cwd) => readTomlDep(cwd, 'fastapi'), tags: ['fastapi', 'python', 'backend'] },
  { check: (cwd) => readTomlDep(cwd, 'torch') || readTomlDep(cwd, 'pytorch'), tags: ['pytorch', 'ml', 'python'] },
  { check: (cwd) => readTomlDep(cwd, 'scikit-learn') || readTomlDep(cwd, 'sklearn'), tags: ['sklearn', 'ml', 'python'] },
  { check: (cwd) => readTomlDep(cwd, 'langchain') || readTomlDep(cwd, 'langgraph'), tags: ['agents', 'langchain'] },
  { check: (cwd) => readTomlDep(cwd, 'anthropic'), tags: ['claude', 'api', 'anthropic'] },
  { check: (cwd) => fs.existsSync(path.join(cwd, 'pyproject.toml')), tags: ['python'] },
  { check: (cwd) => fs.existsSync(path.join(cwd, 'Cargo.toml')), tags: ['rust'] },
  { check: (cwd) => fs.existsSync(path.join(cwd, 'go.mod')), tags: ['go'] },
  { check: (cwd) => hasTfFiles(cwd), tags: ['terraform', 'infrastructure'] },
  { check: (cwd) => fs.existsSync(path.join(cwd, 'pubspec.yaml')), tags: ['flutter', 'dart'] },
  { check: (cwd) => fs.existsSync(path.join(cwd, 'package.json')), tags: ['nodejs'] },
];

function readJsonKey(cwd, file, keyPath) {
  const filePath = path.join(cwd, file);
  if (!fs.existsSync(filePath)) return false;
  try {
    const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = keyPath.split('.');
    let cur = obj;
    for (const k of keys) {
      if (cur == null || typeof cur !== 'object') return false;
      cur = cur[k];
    }
    return cur != null;
  } catch {
    return false;
  }
}

function readTomlDep(cwd, depName) {
  const filePath = path.join(cwd, 'pyproject.toml');
  if (!fs.existsSync(filePath)) return false;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return new RegExp(`["']?${depName}["']?\\s*[=><!]`, 'i').test(content) ||
           content.includes(`"${depName}"`) ||
           content.includes(`'${depName}'`);
  } catch {
    return false;
  }
}

function hasTfFiles(cwd) {
  try {
    if (fs.readdirSync(cwd).some(f => f.endsWith('.tf'))) return true;
    const tfDir = path.join(cwd, 'terraform');
    if (fs.existsSync(tfDir) && fs.readdirSync(tfDir).some(f => f.endsWith('.tf'))) return true;
  } catch {}
  return false;
}

function detectStack(cwd) {
  const tags = new Set();
  for (const detector of STACK_DETECTORS) {
    try {
      if (detector.check(cwd)) {
        for (const tag of detector.tags) tags.add(tag);
      }
    } catch {}
  }
  return Array.from(tags);
}

function searchRegistry(infraDir, tags) {
  const registryPath = path.join(infraDir, 'registry', 'skills.json');
  if (!fs.existsSync(registryPath)) return [];
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch {
    return [];
  }

  const skills = registry.skills || [];
  const results = [];
  for (const skill of skills) {
    const skillTags = skill.tags || [];
    const matchCount = tags.filter(t => skillTags.includes(t)).length;
    if (matchCount > 0) {
      results.push({ ...skill, matchCount });
    }
  }
  results.sort((a, b) => b.matchCount - a.matchCount);
  return results;
}

function runDiscover(infraDir, cwd, opts) {
  const { query, install, json } = opts || {};
  const tags = query ? [query] : detectStack(cwd);

  if (tags.length === 0) {
    console.log('No stack detected. Specify a query: claude-scaffold discover <tag>');
    console.log('Examples: claude-scaffold discover react | python | rust | ml');
    return;
  }

  const matches = searchRegistry(infraDir, tags);

  if (json) {
    console.log(JSON.stringify({ tags, matches }, null, 2));
    return;
  }

  console.log(`\nDetected stack: [${tags.join(', ')}]\n`);

  if (matches.length === 0) {
    console.log('No matching skills found for detected stack.');
    console.log('Add external skill sources: claude-scaffold registry add-source <url>');
    return;
  }

  const nameW = 32;
  const descW = 48;
  console.log(`${'Skill'.padEnd(nameW)} ${'Description'.padEnd(descW)} Tags`);
  console.log(`${'-'.repeat(nameW)} ${'-'.repeat(descW)} ----`);
  for (const skill of matches) {
    const name = skill.name.padEnd(nameW);
    const desc = (skill.description || '').slice(0, descW - 1).padEnd(descW);
    const skillTags = (skill.tags || []).join(', ');
    console.log(`${name} ${desc} ${skillTags}`);
  }
  console.log();

  if (install) {
    try {
      const { runRegistryInstall, getRegistryDir } = require('./registry');
      for (const skill of matches) {
        console.log(`Installing: ${skill.name}`);
        runRegistryInstall(infraDir, cwd, skill.name, {});
      }
    } catch (e) {
      console.error(`Install failed: ${e.message}`);
    }
  } else {
    console.log(`Install a skill: claude-scaffold registry install <skill-name>`);
    console.log(`Install all matches: claude-scaffold discover --install`);
  }
}

module.exports = { detectStack, searchRegistry, runDiscover, readJsonKey, readTomlDep, hasTfFiles };
