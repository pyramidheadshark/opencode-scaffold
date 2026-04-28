'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const INFRA_DIR = path.join(__dirname, '..', '..');
const { deployCore } = require('../../lib/commands/init');
const { addSkill } = require('../../lib/commands/add-skill');


let tmpDir;
let registryPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-addskill-'));
  registryPath = path.join(os.tmpdir(), `cs-test-addskill-reg-${Date.now()}.json`);
  deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
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

  test('add-skill copies SKILL.md and skill-metadata.json', () => {
    addSkill(INFRA_DIR, tmpDir, 'fastapi-patterns');
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'fastapi-patterns');
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'skill-metadata.json'))).toBe(true);
  });

  test('add-skill throws descriptive error when source skill-rules.json missing', () => {
    const fakeInfra = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fake-infra-'));
    const fakeSkill = path.join(fakeInfra, '.claude', 'skills', 'fake-skill');
    fs.mkdirSync(fakeSkill, { recursive: true });
    try {
      expect(() => addSkill(fakeInfra, tmpDir, 'fake-skill')).toThrow('Skill registry not found');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('throws readable error when target skill-rules.json is corrupted', () => {
    const rulesPath = path.join(tmpDir, '.claude', 'skills', 'skill-rules.json');
    fs.writeFileSync(rulesPath, '{ invalid json !!!', 'utf8');
    expect(() => addSkill(INFRA_DIR, tmpDir, 'fastapi-patterns')).toThrow('corrupted');
  });

  test('throws readable error when source skill-rules.json is corrupted', () => {
    const fakeInfra = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fake-infra2-'));
    const fakeSkill = path.join(fakeInfra, '.claude', 'skills', 'fake-skill');
    fs.mkdirSync(fakeSkill, { recursive: true });
    const fakeRules = path.join(fakeInfra, '.claude', 'skills', 'skill-rules.json');
    fs.writeFileSync(fakeRules, '{ invalid json !!!', 'utf8');
    try {
      expect(() => addSkill(fakeInfra, tmpDir, 'fake-skill')).toThrow('corrupted');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });
});
