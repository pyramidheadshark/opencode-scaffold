'use strict';

const fs = require('fs');
const path = require('path');

function newSession(description, cwd) {
  const effectiveCwd = cwd || process.cwd();
  const today = new Date().toISOString().split('T')[0];
  const activeDir = path.join(effectiveCwd, 'dev', 'active');
  fs.mkdirSync(activeDir, { recursive: true });

  const filename = `session-${today}.md`;
  const filepath = path.join(activeDir, filename);

  if (fs.existsSync(filepath)) {
    console.log(`Session contract already exists: ${filepath}`);
    return filepath;
  }

  const templatePath = path.join(__dirname, '..', '..', 'templates', 'session-contract.md');
  let content;
  if (fs.existsSync(templatePath)) {
    content = fs.readFileSync(templatePath, 'utf8')
      .replace('{date}', today)
      .replace('{one sentence — what this session accomplishes}', description || 'TBD');
  } else {
    content = [
      `# Session Contract — ${today}`,
      '',
      '## Goal',
      description || 'TBD',
      '',
      '## Scope',
      '**In:** ',
      '**Out:** ',
      '',
      '## Acceptance Criteria',
      '- [ ] ',
      '',
      '## Done When',
      '',
    ].join('\n');
  }

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Session contract created: ${filepath}`);
  console.log('Fill in the details before starting work.');
  return filepath;
}

module.exports = { newSession };
