'use strict';

const fs = require('fs');
const path = require('path');
const { loadSources, addSource: addSourceToFile } = require('../registry/sources');
const { fetchIndex, mergeIndices, isCacheStale, loadCache, saveCache } = require('../registry/cache');
const { downloadSkill, verifySha256 } = require('../registry/download');

function validateSkillName(name) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    throw new Error(`Invalid skill name: "${name}" — must match [a-z0-9._-]+`);
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error(`Skill name contains invalid path components: "${name}"`);
  }
}

function validateUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid registry source URL: "${url}"`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Invalid URL scheme: ${parsed.protocol} — only http/https allowed`);
  }
}

function getRegistryDir(infraDir) {
  return path.join(infraDir, 'registry');
}

function getSourcesPath(infraDir) {
  return path.join(getRegistryDir(infraDir), 'sources.json');
}

function getCachePath(infraDir) {
  return path.join(getRegistryDir(infraDir), 'cache', 'registry-index.json');
}

async function refreshCache(infraDir) {
  const sources = loadSources(fs, getSourcesPath(infraDir));
  const results = [];

  for (const source of sources.sources) {
    try {
      const index = await fetchIndex(source.url);
      results.push({ source: source.name, index });
    } catch (e) {
      process.stderr.write(`[registry] Warning: ${source.name} (${source.url}): ${e.message}\n`);
    }
  }

  if (results.length === 0) {
    process.stderr.write('[registry] Error: all sources failed to fetch. Cache may be stale.\n');
  }

  const merged = mergeIndices(results);
  const cacheData = {
    updated: new Date().toISOString(),
    sources_count: results.length,
    skills: merged,
  };
  saveCache(fs, getCachePath(infraDir), cacheData);
  return cacheData;
}

async function getSkillIndex(infraDir, forceRefresh = false) {
  const cachePath = getCachePath(infraDir);
  const sources = loadSources(fs, getSourcesPath(infraDir));
  const ttl = sources.cache_ttl_hours || 168;

  if (!forceRefresh && !isCacheStale(fs, cachePath, ttl)) {
    const cached = loadCache(fs, cachePath);
    if (cached) return cached;
  }

  return refreshCache(infraDir);
}

async function runRegistrySearch(infraDir, query) {
  const index = await getSkillIndex(infraDir);
  const q = query.toLowerCase();
  const matches = (index.skills || []).filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q) ||
    (s.tags || []).some(t => t.toLowerCase().includes(q))
  );

  if (matches.length === 0) {
    console.log(`No skills found matching "${query}"`);
    return [];
  }

  console.log(`\nFound ${matches.length} skill(s) matching "${query}":\n`);
  for (const s of matches) {
    const trust = s.trust || s._source || 'unknown';
    console.log(`  ${s.name} (v${s.version}) [${trust}] — ${s.description}`);
    if (s.tags && s.tags.length) console.log(`    tags: ${s.tags.join(', ')}`);
  }
  return matches;
}

async function runRegistryInstall(infraDir, targetDir, skillName, opts = {}) {
  validateSkillName(skillName);
  const index = await getSkillIndex(infraDir);
  const skill = (index.skills || []).find(s => s.name === skillName);

  if (!skill) {
    throw new Error(`Skill "${skillName}" not found in registry`);
  }

  if (skill.trust === 'community' && !opts.force) {
    console.log(`\n⚠ Skill "${skillName}" is from a community source (trust: ${skill.trust || skill._source})`);
    console.log('Use --force to install community skills without confirmation');
    return;
  }

  const destDir = path.join(targetDir, '.claude', 'skills', skillName);
  await downloadSkill(fs, skill.source_url, destDir, skill.sha256);
  console.log(`\n✓ Installed "${skillName}" to ${destDir}`);
  console.log(`  Version: ${skill.version}, Size: ${skill.size_lines} lines, Trust: ${skill.trust}`);
}

async function runRegistryList(infraDir) {
  const index = await getSkillIndex(infraDir);
  const skills = index.skills || [];

  if (skills.length === 0) {
    console.log('Registry cache is empty. Run `registry update` first.');
    return;
  }

  console.log(`\nRegistry: ${skills.length} skills available (updated: ${index.updated || 'unknown'})\n`);
  const grouped = {};
  for (const s of skills) {
    const trust = s.trust || 'unknown';
    if (!grouped[trust]) grouped[trust] = [];
    grouped[trust].push(s);
  }

  for (const [trust, list] of Object.entries(grouped)) {
    console.log(`  [${trust}] (${list.length}):`);
    for (const s of list) {
      console.log(`    ${s.name.padEnd(30)} v${s.version.padEnd(8)} ${s.size_lines || '?'} lines — ${s.description}`);
    }
  }
}

async function runRegistryUpdate(infraDir) {
  console.log('Refreshing registry cache...');
  const data = await refreshCache(infraDir);
  console.log(`✓ Cache updated: ${(data.skills || []).length} skills from ${data.sources_count} source(s)`);
}

const VALID_TRUST_LEVELS = ['verified', 'community', 'untrusted'];

async function runRegistryAddSource(infraDir, name, url, opts = {}) {
  validateUrl(url);
  const trust = opts.trust || 'community';
  if (!VALID_TRUST_LEVELS.includes(trust)) {
    throw new Error(`Invalid trust level: "${trust}". Must be one of: ${VALID_TRUST_LEVELS.join(', ')}`);
  }
  addSourceToFile(fs, getSourcesPath(infraDir), name, url, trust);
  console.log(`✓ Source "${name}" added (trust: ${trust})`);
  console.log(`  URL: ${url}`);
  console.log('Run `registry update` to fetch skills from the new source.');
}

module.exports = {
  runRegistrySearch,
  runRegistryInstall,
  runRegistryList,
  runRegistryUpdate,
  runRegistryAddSource,
  getSkillIndex,
  refreshCache,
};
