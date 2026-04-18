'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { listRepos, getSkillRules, getAvailableProfiles } = require('../../lib/tui/config-manager');

describe('listRepos', () => {
  it('returns empty array when registry file is missing', () => {
    const result = listRepos(path.join(os.tmpdir(), `nonexistent-${Date.now()}.json`));
    expect(result).toEqual([]);
  });

  it('normalises registry entries into repo objects', () => {
    const tmp = path.join(os.tmpdir(), `registry-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({
      deployed: [
        {
          path: '/projects/my-service',
          skills: ['python-project-standards', 'fastapi-patterns'],
          ci_profile: 'fastapi',
          deploy_target: 'yc',
          deployed_at: '2026-04-01',
          infra_sha: 'abc1234',
        },
      ],
    }));
    const result = listRepos(tmp);
    expect(result).toHaveLength(1);
    const repo = result[0];
    expect(repo.name).toBe('my-service');
    expect(repo.path).toBe('/projects/my-service');
    expect(repo.skills).toEqual(['python-project-standards', 'fastapi-patterns']);
    expect(repo.ciProfile).toBe('fastapi');
    expect(repo.deployTarget).toBe('yc');
    expect(repo.deployedAt).toBe('2026-04-01');
    expect(repo.infraSha).toBe('abc1234');
    fs.unlinkSync(tmp);
  });

  it('handles missing optional fields gracefully', () => {
    const tmp = path.join(os.tmpdir(), `registry-sparse-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ deployed: [{ path: '/projects/bare' }] }));
    const result = listRepos(tmp);
    expect(result[0].skills).toEqual([]);
    expect(result[0].ciProfile).toBe('');
    expect(result[0].deployTarget).toBe('none');
    fs.unlinkSync(tmp);
  });
});

describe('getSkillRules', () => {
  it('returns empty array when repo has no skill-rules.json', () => {
    const result = getSkillRules(path.join(os.tmpdir(), `no-rules-${Date.now()}`));
    expect(result).toEqual([]);
  });

  it('returns rules array from valid skill-rules.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tui-rules-'));
    const skillsDir = path.join(tmp, '.claude', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'skill-rules.json'), JSON.stringify({
      version: '1.0',
      rules: [
        { skill: 'python-project-standards', triggers: { files: ['*.py'] }, priority: 1 },
        { skill: 'fastapi-patterns', triggers: { files: ['main.py'] }, priority: 2 },
      ],
    }));
    const result = getSkillRules(tmp);
    expect(result).toHaveLength(2);
    expect(result[0].skill).toBe('python-project-standards');
    expect(result[1].priority).toBe(2);
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns empty array when skill-rules.json is malformed', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tui-bad-'));
    const skillsDir = path.join(tmp, '.claude', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'skill-rules.json'), 'not json {{{');
    const result = getSkillRules(tmp);
    expect(result).toEqual([]);
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns empty array when rules field is absent', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tui-norules-'));
    const skillsDir = path.join(tmp, '.claude', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'skill-rules.json'), JSON.stringify({ version: '1.0' }));
    const result = getSkillRules(tmp);
    expect(result).toEqual([]);
    fs.rmSync(tmp, { recursive: true });
  });
});

describe('getAvailableProfiles', () => {
  it('returns a non-empty list of profile name strings', () => {
    const profiles = getAvailableProfiles();
    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBeGreaterThan(0);
    profiles.forEach(p => expect(typeof p).toBe('string'));
  });
});
