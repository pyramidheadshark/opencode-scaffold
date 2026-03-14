'use strict';

const fs = require('fs');
const path = require('path');
const copy = require('../deploy/copy');

function addSkill(infraDir, targetDir, skillName) {
  const skillSrc = path.join(infraDir, '.claude', 'skills', skillName);
  if (!fs.existsSync(skillSrc)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  const skillDst = path.join(targetDir, '.claude', 'skills', skillName);
  copy.copyDirRecursive(skillSrc, skillDst);

  const targetRulesPath = path.join(targetDir, '.claude', 'skills', 'skill-rules.json');
  const sourceRulesPath = path.join(infraDir, '.claude', 'skills', 'skill-rules.json');

  let targetRules = { rules: [] };
  if (fs.existsSync(targetRulesPath)) {
    targetRules = JSON.parse(fs.readFileSync(targetRulesPath, 'utf8'));
  }

  const alreadyPresent = targetRules.rules.some(r => r.skill === skillName);
  if (!alreadyPresent) {
    const sourceRules = JSON.parse(fs.readFileSync(sourceRulesPath, 'utf8'));
    const sourceRule = sourceRules.rules.find(r => r.skill === skillName);
    if (sourceRule) {
      const newRule = { ...sourceRule, priority: targetRules.rules.length + 1 };
      targetRules.rules.push(newRule);
      fs.writeFileSync(targetRulesPath, JSON.stringify(targetRules, null, 2), 'utf8');
    }
  }
}

module.exports = { addSkill };
