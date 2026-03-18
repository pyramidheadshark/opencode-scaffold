'use strict';

const fs = require('fs');
const path = require('path');
const { getCurrentSha } = require('../deploy/git');

function loadOrgProfile(infraDir, org) {
  const profilePath = path.join(infraDir, 'org-profiles', org, 'profile.json');
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Org profile '${org}' not found. Expected: ${profilePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse profile.json for org '${org}': ${e.message}`);
  }
}

function deployOrgTemplate(infraDir, targetDir, org, type, lang) {
  const langSuffix = lang === 'ru' ? 'ru' : 'en';
  const templatePath = path.join(
    infraDir, 'org-profiles', org, 'templates', type, `CLAUDE.md.${langSuffix}`
  );
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template not found: org-profiles/${org}/templates/${type}/CLAUDE.md.${langSuffix}`
    );
  }
  const destPath = path.join(targetDir, '.claude', 'CLAUDE.md');
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(templatePath, destPath);
  return { copied: true, templatePath };
}

function readExistingMeta(targetDir) {
  const metaPath = path.join(targetDir, '.claude', '.scaffold-meta.json');
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return {};
  }
}

function writeScaffoldMeta(infraDir, targetDir, opts) {
  const existing = readExistingMeta(targetDir);
  const now = new Date().toISOString();
  const meta = {
    scaffold_version: getCurrentSha(infraDir) || 'unknown',
    base_profile: opts.baseProfile || existing.base_profile || '',
    deployed_at: existing.deployed_at || now,
    updated_at: now,
  };
  if (opts.org) {
    meta.org = opts.org;
    meta.type = opts.type || '';
  } else if (existing.org) {
    meta.org = existing.org;
    meta.type = existing.type || '';
  }
  const metaPath = path.join(targetDir, '.claude', '.scaffold-meta.json');
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

function listOrgProfiles(infraDir) {
  const orgProfilesDir = path.join(infraDir, 'org-profiles');
  if (!fs.existsSync(orgProfilesDir)) return [];
  const entries = fs.readdirSync(orgProfilesDir).filter(f => {
    return fs.statSync(path.join(orgProfilesDir, f)).isDirectory();
  });
  return entries.map(org => {
    const profilePath = path.join(orgProfilesDir, org, 'profile.json');
    if (!fs.existsSync(profilePath)) return null;
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      const types = Object.entries(profile.project_types || {}).map(([name, def]) => ({
        name,
        description: def.description || '',
      }));
      return { org, description: profile.description || '', types };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function updateOrgProfile(infraDir, org, opts) {
  const profile = loadOrgProfile(infraDir, org);
  let repos = opts.repos || null;
  if (!repos) {
    const reposPath = path.join(infraDir, 'org-profiles', org, 'repos.json');
    if (!fs.existsSync(reposPath)) {
      throw new Error(
        `repos.json not found for org '${org}'. Provide --repos or create org-profiles/${org}/repos.json`
      );
    }
    const reposData = JSON.parse(fs.readFileSync(reposPath, 'utf8'));
    repos = reposData.repos || [];
  }

  const updated = [];
  const skipped = [];
  const errors = [];

  for (const repo of repos) {
    const repoPath = typeof repo === 'string' ? repo : repo.path;
    const repoType = typeof repo === 'string' ? null : repo.type;
    const name = typeof repo === 'string' ? path.basename(repo) : repo.name;

    if (!fs.existsSync(repoPath)) {
      errors.push({ name, error: `directory not found: ${repoPath}` });
      continue;
    }

    let type = repoType;
    if (!type) {
      const existing = readExistingMeta(repoPath);
      type = existing.type || null;
    }

    if (!type) {
      skipped.push({ name, reason: 'no type determined — add to repos.json or run init first' });
      continue;
    }

    if (!profile.project_types || !profile.project_types[type]) {
      errors.push({ name, error: `unknown type '${type}' for org '${org}'` });
      continue;
    }

    try {
      const existing = readExistingMeta(repoPath);
      const lang = opts.lang || 'en';
      deployOrgTemplate(infraDir, repoPath, org, type, lang);
      writeScaffoldMeta(infraDir, repoPath, {
        baseProfile: existing.base_profile || '',
        org,
        type,
      });
      updated.push(name);
    } catch (e) {
      errors.push({ name, error: e.message });
    }
  }

  return { updated, skipped, errors };
}

module.exports = {
  loadOrgProfile,
  deployOrgTemplate,
  readExistingMeta,
  writeScaffoldMeta,
  listOrgProfiles,
  updateOrgProfile,
};
