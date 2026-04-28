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

    if (currentModel === targetModel) {
      console.log(`✅ ${repo}: already ${targetModel}`);
      continue;
    }

    settings.model = targetModel;
    settings.altModelProvider = 'openrouter';

    // Ensure OpenRouter env vars
    settings.env = settings.env || {};
    settings.env.ANTHROPIC_BASE_URL = 'https://openrouter.ai/api/v1';
    settings.env.ANTHROPIC_AUTH_TOKEN = '${OPENROUTER_API_KEY}';
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