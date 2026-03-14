'use strict';

const { execSync } = require('child_process');

function getCurrentSha(infraDir) {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: infraDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

module.exports = { getCurrentSha };
