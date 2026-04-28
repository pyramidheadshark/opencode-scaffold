'use strict';

const fs = require('fs');
const path = require('path');
const { loadRegistry } = require('../deploy/registry');
const { getCurrentSha } = require('../deploy/git');

function getStatusReport(infraDir, registryPath) {
  const registry = loadRegistry(registryPath);
  const currentSha = getCurrentSha(infraDir);

  const entries = registry.deployed.map(entry => {
    const p = entry.path;
    let status;

    if (!fs.existsSync(p)) {
      status = 'NOT FOUND on disk';
    } else {
      const versionFile = path.join(p, '.claude', 'infra-version');
      if (!fs.existsSync(versionFile)) {
        status = 'no version file';
      } else {
        const repoSha = fs.readFileSync(versionFile, 'utf8').trim();
        status = repoSha === currentSha ? 'up to date' : `OUTDATED (${repoSha})`;
      }
    }

    return {
      name: path.basename(p),
      path: p,
      status,
      skills: entry.skills || [],
      ciProfile: entry.ci_profile || '',
      deployedAt: entry.deployed_at || '',
    };
  });

  return { currentSha, entries };
}

function printStatusReport(infraDir, registryPath) {
  const { currentSha, entries } = getStatusReport(infraDir, registryPath);
  const line = '-'.repeat(60);

  try {
    const modelRouter = require('./model-router');
    const active = modelRouter.getActiveProfile();
    if (active) {
      const profile = modelRouter.PROFILES[active.profile];
      console.log(`Active model: ${active.profile} — ${profile ? profile.model : active.model} (${active.provider})`);
      if (profile && profile.experimental) console.log('⚠ Experimental model active');
      console.log(`Run 'claude-scaffold use sonnet' to switch to default.`);
    } else {
      console.log('Active model: default (claude-sonnet-4-6)');
    }
  } catch {
    console.log('Active model: default (claude-sonnet-4-6)');
  }
  console.log();

  console.log(line);
  console.log(`  Deployed repos  (infra HEAD: ${currentSha})`);
  console.log(line);

  if (entries.length === 0) {
    console.log('  No deployed repos registered.');
    return;
  }

  for (const e of entries) {
    console.log(`  ${e.name.padEnd(32)} [${e.status}]`);
    console.log(`    path     : ${e.path}`);
    console.log(`    skills   : ${e.skills.join(', ')}`);
    console.log(`    CI       : ${e.ciProfile || 'none'}  deployed: ${e.deployedAt}`);
    console.log();
  }
}

module.exports = { getStatusReport, printStatusReport };
