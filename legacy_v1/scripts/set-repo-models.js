#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPOS_DIR = path.resolve(__dirname, '..', '..');

const HUB_REPOS = ['dumpster', 'rgs_hub', 'techcon_hub'];
const HUB_MODEL = 'z-ai/glm-5.1';
const DEFAULT_MODEL = 'moonshotai/kimi-k2.6';

const repos = fs.readdirSync(REPOS_DIR).filter(name => {
  return fs.existsSync(path.join(REPOS_DIR, name, '.git'));
});

let updated = 0;
let skipped = 0;

for (const repo of repos) {
  const settingsPath = path.join(REPOS_DIR, repo, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    console.log(`⏭️  ${repo} — no settings.json, skipping`);
    skipped++;
    continue;
  }

  const isHub = HUB_REPOS.includes(repo);
  const targetModel = isHub ? HUB_MODEL : DEFAULT_MODEL;

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const currentModel = settings.model || '(none)';

    // Always update env vars (CCR URL and auth)
    settings.env = settings.env || {};
    const needsEnvUpdate = settings.env.ANTHROPIC_BASE_URL !== 'http://127.0.0.1:3456' ||
                          !settings.env.ANTHROPIC_AUTH_TOKEN || settings.env.ANTHROPIC_AUTH_TOKEN === '${OPENROUTER_API_KEY}';

    if (currentModel === targetModel && !needsEnvUpdate) {
      console.log(`✅ ${repo}: already ${targetModel}`);
      continue;
    }

    settings.model = targetModel;
    settings.altModelProvider = 'openrouter';

    // Ensure CCR env vars
    settings.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:3456';
    settings.env.ANTHROPIC_AUTH_TOKEN = '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';
    settings.env.ANTHROPIC_API_KEY = '';

    // Add scaffold metadata
    settings.scaffold = settings.scaffold || {};
    settings.scaffold.provider = 'openrouter';
    settings.scaffold.ccrEnabled = true;

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    console.log(`🔧 ${repo}: ${currentModel} → ${targetModel} (${isHub ? 'HUB' : 'default'})`);
    updated++;
  } catch (e) {
    console.log(`❌ ${repo}: error — ${e.message}`);
  }
}

console.log(`\n📊 Updated: ${updated}, Skipped: ${skipped}, Total repos: ${repos.length}`);