'use strict';
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, '..', 'deployed-repos.json');
const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const before = reg.deployed.length;

reg.deployed = reg.deployed.filter(e => {
  const p = e.path || '';
  return !p.includes('cs-test-') && !p.includes('AppData\\Local\\Temp') && !p.includes('/tmp/cs-test');
});

const after = reg.deployed.length;
fs.writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf8');
console.log(`Removed: ${before - after} stale temp entries. Remaining: ${after}`);
