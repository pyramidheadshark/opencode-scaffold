'use strict';

const readline = require('readline');

const PROFILES = require('../profiles');

const CI_PROFILES = [
  { name: 'minimal',    desc: 'Lint + typecheck + test' },
  { name: 'fastapi',    desc: 'Lint + typecheck + test + docker-build' },
  { name: 'fastapi-db', desc: 'Lint + typecheck + test (Postgres) + docker-build' },
  { name: 'ml-heavy',   desc: 'Lint + typecheck + test (HF cache) + security scan + docker-build' },
];

const DEPLOY_TARGETS = [
  { name: 'none', desc: 'No deploy stage — CI only' },
  { name: 'yc',   desc: 'Yandex Cloud Container Registry + Serverless Container' },
  { name: 'vps',  desc: 'VPS / bare metal via SSH + docker-compose pull' },
];

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function runWizard() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const line = '-'.repeat(60);

  console.log(`\n${line}`);
  console.log('  claude-scaffold :: Deploy Wizard');
  console.log(line);
  console.log();

  const targetPath = (await ask(rl, '  Target project directory: ')).trim();
  if (!targetPath) { rl.close(); process.exit(1); }

  console.log();
  console.log('  Profile:');
  console.log(`  ${'-'.repeat(54)}`);
  const profileNames = Object.keys(PROFILES);
  profileNames.forEach((name, i) => {
    console.log(`    ${i + 1}. ${name}`);
  });
  console.log(`    0. Custom — enter skill names manually`);
  console.log(`  ${'-'.repeat(54)}`);
  console.log();

  const profileChoice = (await ask(rl, '  Profile number (or 0 for custom): ')).trim();
  let skills = [];
  let profileName = '';

  if (/^\d+$/.test(profileChoice)) {
    const idx = parseInt(profileChoice, 10);
    if (idx >= 1 && idx <= profileNames.length) {
      profileName = profileNames[idx - 1];
      skills = PROFILES[profileName].skills;
      console.log(`\n  Selected profile: ${profileName}`);
      console.log(`  Skills: ${skills.join(', ')}`);
    }
  }

  if (skills.length === 0) {
    const raw = (await ask(rl, '  Enter skill names separated by commas: ')).trim();
    skills = raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  console.log();
  console.log('  Language:');
  console.log('    1. en (English)');
  console.log('    2. ru (Russian)');
  const langChoice = (await ask(rl, '  Language (1 or 2): ')).trim();
  const lang = langChoice === '2' ? 'ru' : 'en';

  console.log();
  console.log('  CI/CD Profile:');
  console.log(`  ${'-'.repeat(54)}`);
  console.log('    0. Skip — no CI workflow');
  CI_PROFILES.forEach((p, i) => {
    console.log(`    ${i + 1}. ${p.name.padEnd(14)} ${p.desc}`);
  });
  console.log(`  ${'-'.repeat(54)}`);
  console.log();

  const ciChoice = (await ask(rl, '  CI profile (0 to skip): ')).trim();
  let ciProfile = '';
  let deployTarget = 'none';

  if (/^\d+$/.test(ciChoice)) {
    const idx = parseInt(ciChoice, 10);
    if (idx >= 1 && idx <= CI_PROFILES.length) {
      ciProfile = CI_PROFILES[idx - 1].name;
      console.log(`\n  Selected CI profile: ${ciProfile}`);

      console.log();
      console.log('  Deploy target:');
      console.log(`  ${'-'.repeat(54)}`);
      DEPLOY_TARGETS.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.name.padEnd(8)} ${t.desc}`);
      });
      console.log(`  ${'-'.repeat(54)}`);
      console.log();

      const depChoice = (await ask(rl, '  Deploy target (1 for none): ')).trim();
      if (/^\d+$/.test(depChoice)) {
        const depIdx = parseInt(depChoice, 10);
        if (depIdx >= 1 && depIdx <= DEPLOY_TARGETS.length) {
          deployTarget = DEPLOY_TARGETS[depIdx - 1].name;
        }
      }
      console.log(`  Deploy target: ${deployTarget}`);
    }
  } else {
    console.log('  Skipping CI workflow.');
  }

  rl.close();
  console.log();

  return { targetPath, skills, lang, ciProfile, deployTarget, profileName };
}

module.exports = { runWizard, PROFILES, CI_PROFILES, DEPLOY_TARGETS };
