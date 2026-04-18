'use strict';

const fs = require('fs');
const path = require('path');
const { applyTuningOverwrite } = require('../deploy/copy');

function runTune(targetDir, tuning) {
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  let existing = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      existing = {};
    }
  }
  applyTuningOverwrite(existing, tuning);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return { settingsPath, env: existing.env || {}, showThinkingSummaries: existing.showThinkingSummaries };
}

module.exports = { runTune };
