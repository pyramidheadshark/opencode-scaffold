'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const INFRA_DIR = path.join(__dirname, '..', '..');
const { deployCore } = require('../../lib/commands/init');
const { addSkill } = require('../../lib/commands/add-skill');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-addskill-'));
  deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'] });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('add-skill — addSkill', () => {
  test('copies skill directory to target', () => {
    addSkill(INFRA_DIR, tmpDir, 'fastapi-patterns');
    expect(
      fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'fastapi-patterns'))
    ).toBe(true);
  });

  test('updates skill-rules.json to include new skill', () => {
    addSkill(INFRA_DIR, tmpDir, 'fastapi-patterns');
    const rulesPath = path.join(tmpDir, '.claude', 'skills', 'skill-rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const skillNames = rules.rules.map(r => r.skill);
    expect(skillNames).toContain('fastapi-patterns');
    expect(skillNames).toContain('python-project-standards');
  });

  test('does not duplicate skill in skill-rules.json if already present', () => {
    addSkill(INFRA_DIR, tmpDir, 'python-project-standards');
    const rulesPath = path.join(tmpDir, '.claude', 'skills', 'skill-rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const count = rules.rules.filter(r => r.skill === 'python-project-standards').length;
    expect(count).toBe(1);
  });

  test('throws for unknown skill name', () => {
    expect(() => addSkill(INFRA_DIR, tmpDir, 'nonexistent-skill')).toThrow();
  });

  test('preserves existing skills when adding a new one', () => {
    addSkill(INFRA_DIR, tmpDir, 'fastapi-patterns');
    const rulesPath = path.join(tmpDir, '.claude', 'skills', 'skill-rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const skillNames = rules.rules.map(r => r.skill);
    expect(skillNames).toContain('python-project-standards');
  });
});
