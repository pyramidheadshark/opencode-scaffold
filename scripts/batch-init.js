#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const REPOS_DIR = path.resolve(__dirname, '..', '..');
const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

// Hub repos get GLM 5.1, others get Kimi K2.6
const HUB_REPOS = ['dumpster', 'rgs_hub', 'techcon_hub'];
const ALL_REPOS = [
  'bris_zhkh_assistant', 'coris_landing_site', 'filemind', 'fkr_hmao_test_bot',
  'hotel_landing_site', 'milvm', 'phs_calorie_app', 'rgs_babush_prompt_helper',
  'rgs_check_ocr_bot', 'rgs_competitive_intel', 'rgs_docx', 'rgs_find_person_photos',
  'rgs_meeting_consent', 'rgs_nalog_parser', 'rgs_plaude_copycat',
  'rgs_regional_budget_analysis', 'rgs_sd_support_suggestions', 'rgs_smart_drive',
  'rgs_transcribe', 'rgs_vvm', 'techcon_activity_graph', 'techcon_defectoscopy',
  'techcon_defects_stt_plus', 'techcon_demos', 'techcon_education_assistant',
  'techcon_infra_monitoring', 'techcon_infra_yac', 'techcon_integration',
  'techcon_integration_audit', 'techcon_mkd_validator', 'techcon_passports',
  'techcon_reports', 'techcon_techplans_search', 'uni_ke_practicum', 'uni_practices_sem6',
  'dumpster', 'rgs_hub', 'techcon_hub'
];

let success = 0;
let failed = 0;

for (const repo of ALL_REPOS) {
  const repoPath = path.join(REPOS_DIR, repo);
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    console.log(`⏭️  ${repo} — not a git repo, skipping`);
    continue;
  }

  const model = HUB_REPOS.includes(repo) ? 'glm' : 'kimi';
  console.log(`\n🔧 Initializing ${repo} with model ${model}...`);

  try {
    // Init with openrouter provider
    execSync(`node "${CLI}" init --provider openrouter --profile ai-developer --force "${repoPath}"`, {
      stdio: 'pipe',
      timeout: 30000,
      cwd: path.join(__dirname, '..')
    });
    console.log(`  ✅ ${repo} initialized`);
  } catch (e) {
    console.log(`  ❌ ${repo} init failed: ${e.message.slice(0, 100)}`);
    failed++;
    continue;
  }

  // Set model via CCR
  try {
    execSync(`node "${CLI}" use ${model}`, {
      stdio: 'pipe',
      timeout: 15000,
      cwd: path.join(__dirname, '..')
    });
    console.log(`  ✅ ${repo} model set to ${model}`);
    success++;
  } catch (e) {
    console.log(`  ⚠️  ${repo} model set failed: ${e.message.slice(0, 100)}`);
    // Not critical — init succeeded
    success++;
  }
}

console.log(`\n📊 Done: ${success} repos initialized, ${failed} failed`);