'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const INFRA_DIR = path.join(__dirname, '..', '..');
const {
  loadOrgProfile,
  deployOrgTemplate,
  readExistingMeta,
  writeScaffoldMeta,
  listOrgProfiles,
  updateOrgProfile,
} = require('../../lib/commands/org-profile');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-orgprofile-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeFakeInfra(opts = {}) {
  const fakeInfra = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fake-infra-org-'));
  const orgDir = path.join(fakeInfra, 'org-profiles', opts.org || 'test-org');
  fs.mkdirSync(orgDir, { recursive: true });

  const profile = {
    org: opts.org || 'test-org',
    description: opts.description || 'Test org',
    project_types: opts.project_types || {
      'type-a': { description: 'Type A', base_profile: 'ai-developer' },
      'type-b': { description: 'Type B', base_profile: 'ai-developer' },
    },
  };
  fs.writeFileSync(path.join(orgDir, 'profile.json'), JSON.stringify(profile), 'utf8');

  if (opts.templates) {
    for (const [typeName, content] of Object.entries(opts.templates)) {
      const typeDir = path.join(orgDir, 'templates', typeName);
      fs.mkdirSync(typeDir, { recursive: true });
      fs.writeFileSync(path.join(typeDir, 'CLAUDE.md.en'), content.en || `# ${typeName} EN`, 'utf8');
      fs.writeFileSync(path.join(typeDir, 'CLAUDE.md.ru'), content.ru || `# ${typeName} RU`, 'utf8');
    }
  }

  if (opts.repos) {
    fs.writeFileSync(path.join(orgDir, 'repos.json'), JSON.stringify({ repos: opts.repos }), 'utf8');
  }

  return fakeInfra;
}

describe('loadOrgProfile', () => {
  test('returns profile for valid org', () => {
    const fakeInfra = makeFakeInfra({ org: 'my-org' });
    try {
      const profile = loadOrgProfile(fakeInfra, 'my-org');
      expect(profile.org).toBe('my-org');
      expect(profile.project_types).toBeDefined();
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('throws for unknown org', () => {
    const fakeInfra = makeFakeInfra({ org: 'real-org' });
    try {
      expect(() => loadOrgProfile(fakeInfra, 'nonexistent-org'))
        .toThrow(/not found/);
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('throws for malformed profile.json', () => {
    const fakeInfra = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fake-infra-org-'));
    const orgDir = path.join(fakeInfra, 'org-profiles', 'bad-org');
    fs.mkdirSync(orgDir, { recursive: true });
    fs.writeFileSync(path.join(orgDir, 'profile.json'), '{invalid json', 'utf8');
    try {
      expect(() => loadOrgProfile(fakeInfra, 'bad-org'))
        .toThrow(/Failed to parse/);
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });
});

describe('deployOrgTemplate', () => {
  test('copies EN template to .claude/CLAUDE.md', () => {
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      templates: { 'ml-pipeline': { en: '# ML Pipeline EN content', ru: '# ML Pipeline RU' } },
    });
    try {
      deployOrgTemplate(fakeInfra, tmpDir, 'my-org', 'ml-pipeline', 'en');
      const dest = path.join(tmpDir, '.claude', 'CLAUDE.md');
      expect(fs.existsSync(dest)).toBe(true);
      expect(fs.readFileSync(dest, 'utf8')).toBe('# ML Pipeline EN content');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('copies RU template when lang is ru', () => {
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      templates: { 'ml-pipeline': { en: '# EN', ru: '# RU content' } },
    });
    try {
      deployOrgTemplate(fakeInfra, tmpDir, 'my-org', 'ml-pipeline', 'ru');
      const dest = path.join(tmpDir, '.claude', 'CLAUDE.md');
      expect(fs.readFileSync(dest, 'utf8')).toBe('# RU content');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('overwrites existing CLAUDE.md', () => {
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      templates: { 'ml-pipeline': { en: '# New content' } },
    });
    try {
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), '# Old content', 'utf8');
      deployOrgTemplate(fakeInfra, tmpDir, 'my-org', 'ml-pipeline', 'en');
      expect(fs.readFileSync(path.join(claudeDir, 'CLAUDE.md'), 'utf8')).toBe('# New content');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('throws when template file not found', () => {
    const fakeInfra = makeFakeInfra({ org: 'my-org' });
    try {
      expect(() => deployOrgTemplate(fakeInfra, tmpDir, 'my-org', 'nonexistent-type', 'en'))
        .toThrow(/Template not found/);
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('returns { copied: true, templatePath }', () => {
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      templates: { 'type-a': { en: '# content' } },
    });
    try {
      const result = deployOrgTemplate(fakeInfra, tmpDir, 'my-org', 'type-a', 'en');
      expect(result.copied).toBe(true);
      expect(result.templatePath).toContain('CLAUDE.md.en');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });
});

describe('writeScaffoldMeta', () => {
  test('creates .scaffold-meta.json with required fields', () => {
    writeScaffoldMeta(INFRA_DIR, tmpDir, { baseProfile: 'ai-developer' });
    const metaPath = path.join(tmpDir, '.claude', '.scaffold-meta.json');
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(meta.scaffold_version).toBeDefined();
    expect(meta.base_profile).toBe('ai-developer');
    expect(meta.deployed_at).toBeDefined();
    expect(meta.updated_at).toBeDefined();
  });

  test('includes org and type when provided', () => {
    writeScaffoldMeta(INFRA_DIR, tmpDir, {
      baseProfile: 'ai-developer',
      org: 'techcon-ml',
      type: 'ml-pipeline',
    });
    const meta = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', '.scaffold-meta.json'), 'utf8')
    );
    expect(meta.org).toBe('techcon-ml');
    expect(meta.type).toBe('ml-pipeline');
  });

  test('does not include org when not provided and not in existing meta', () => {
    writeScaffoldMeta(INFRA_DIR, tmpDir, { baseProfile: 'ai-developer' });
    const meta = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', '.scaffold-meta.json'), 'utf8')
    );
    expect(meta.org).toBeUndefined();
  });

  test('preserves deployed_at on subsequent writes', () => {
    writeScaffoldMeta(INFRA_DIR, tmpDir, { baseProfile: 'ai-developer' });
    const first = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', '.scaffold-meta.json'), 'utf8')
    );
    writeScaffoldMeta(INFRA_DIR, tmpDir, { baseProfile: 'ai-developer' });
    const second = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', '.scaffold-meta.json'), 'utf8')
    );
    expect(second.deployed_at).toBe(first.deployed_at);
    expect(second.updated_at).toBeDefined();
  });

  test('preserves org/type from existing meta when not provided in opts', () => {
    writeScaffoldMeta(INFRA_DIR, tmpDir, {
      baseProfile: 'ai-developer',
      org: 'techcon-ml',
      type: 'ml-pipeline',
    });
    writeScaffoldMeta(INFRA_DIR, tmpDir, { baseProfile: 'ai-developer' });
    const meta = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', '.scaffold-meta.json'), 'utf8')
    );
    expect(meta.org).toBe('techcon-ml');
    expect(meta.type).toBe('ml-pipeline');
  });
});

describe('readExistingMeta', () => {
  test('returns empty object when no meta file', () => {
    expect(readExistingMeta(tmpDir)).toEqual({});
  });

  test('returns parsed meta when file exists', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, '.scaffold-meta.json'),
      JSON.stringify({ org: 'my-org', type: 'ml-pipeline', deployed_at: '2026-01-01T00:00:00Z' }),
      'utf8'
    );
    const meta = readExistingMeta(tmpDir);
    expect(meta.org).toBe('my-org');
    expect(meta.type).toBe('ml-pipeline');
  });

  test('returns empty object on malformed JSON', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, '.scaffold-meta.json'), '{bad json', 'utf8');
    expect(readExistingMeta(tmpDir)).toEqual({});
  });
});

describe('listOrgProfiles', () => {
  test('returns empty array when org-profiles/ does not exist', () => {
    const fakeInfra = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fake-infra-org-'));
    try {
      expect(listOrgProfiles(fakeInfra)).toEqual([]);
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('returns org list with types', () => {
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      description: 'My Org Description',
    });
    try {
      const profiles = listOrgProfiles(fakeInfra);
      expect(profiles).toHaveLength(1);
      expect(profiles[0].org).toBe('my-org');
      expect(profiles[0].description).toBe('My Org Description');
      expect(profiles[0].types).toHaveLength(2);
      const typeNames = profiles[0].types.map(t => t.name);
      expect(typeNames).toContain('type-a');
      expect(typeNames).toContain('type-b');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('skips orgs without profile.json', () => {
    const fakeInfra = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fake-infra-org-'));
    const orphanDir = path.join(fakeInfra, 'org-profiles', 'orphan-org');
    fs.mkdirSync(orphanDir, { recursive: true });
    try {
      expect(listOrgProfiles(fakeInfra)).toEqual([]);
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });
});

describe('updateOrgProfile', () => {
  test('updates CLAUDE.md for repos from repos.json', () => {
    const repoA = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-repo-a-'));
    const repoB = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-repo-b-'));

    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      templates: {
        'type-a': { en: '# Type A template' },
        'type-b': { en: '# Type B template' },
      },
      repos: [
        { name: 'repo-a', path: repoA, type: 'type-a' },
        { name: 'repo-b', path: repoB, type: 'type-b' },
      ],
    });

    try {
      const result = updateOrgProfile(fakeInfra, 'my-org', {});
      expect(result.updated).toContain('repo-a');
      expect(result.updated).toContain('repo-b');
      expect(result.errors).toHaveLength(0);

      const contentA = fs.readFileSync(path.join(repoA, '.claude', 'CLAUDE.md'), 'utf8');
      expect(contentA).toBe('# Type A template');
      const contentB = fs.readFileSync(path.join(repoB, '.claude', 'CLAUDE.md'), 'utf8');
      expect(contentB).toBe('# Type B template');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
      fs.rmSync(repoA, { recursive: true, force: true });
      fs.rmSync(repoB, { recursive: true, force: true });
    }
  });

  test('also writes .scaffold-meta.json for each updated repo', () => {
    const repoA = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-repo-meta-'));
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      templates: { 'type-a': { en: '# content' } },
      repos: [{ name: 'repo-a', path: repoA, type: 'type-a' }],
    });
    try {
      updateOrgProfile(fakeInfra, 'my-org', {});
      const metaPath = path.join(repoA, '.claude', '.scaffold-meta.json');
      expect(fs.existsSync(metaPath)).toBe(true);
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      expect(meta.org).toBe('my-org');
      expect(meta.type).toBe('type-a');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
      fs.rmSync(repoA, { recursive: true, force: true });
    }
  });

  test('records error for missing repo directory', () => {
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      repos: [{ name: 'ghost-repo', path: '/nonexistent/path/ghost-repo', type: 'type-a' }],
    });
    try {
      const result = updateOrgProfile(fakeInfra, 'my-org', {});
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].name).toBe('ghost-repo');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('skips repo with no type in repos.json and no existing meta', () => {
    const repoNoType = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-repo-notype-'));
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      repos: [{ name: 'no-type-repo', path: repoNoType, type: null }],
    });
    try {
      const result = updateOrgProfile(fakeInfra, 'my-org', {});
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].name).toBe('no-type-repo');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
      fs.rmSync(repoNoType, { recursive: true, force: true });
    }
  });

  test('throws when repos.json not found and no --repos provided', () => {
    const fakeInfra = makeFakeInfra({ org: 'my-org' });
    try {
      expect(() => updateOrgProfile(fakeInfra, 'my-org', {}))
        .toThrow(/repos.json not found/);
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
    }
  });

  test('uses explicit repos list when provided', () => {
    const repoA = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-repo-explicit-'));
    const fakeInfra = makeFakeInfra({
      org: 'my-org',
      templates: { 'type-a': { en: '# explicit content' } },
    });
    try {
      const result = updateOrgProfile(fakeInfra, 'my-org', {
        repos: [{ name: 'repo-a', path: repoA, type: 'type-a' }],
      });
      expect(result.updated).toContain('repo-a');
    } finally {
      fs.rmSync(fakeInfra, { recursive: true, force: true });
      fs.rmSync(repoA, { recursive: true, force: true });
    }
  });
});

describe('integration: deployCore with org-profile', () => {
  const { deployCore } = require('../../lib/commands/init');
  let registryPath;

  beforeEach(() => {
    registryPath = path.join(os.tmpdir(), `cs-test-init-reg-org-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
  });

  test('deployCore with --org-profile deploys correct CLAUDE.md', () => {
    deployCore(INFRA_DIR, tmpDir, {
      skills: ['python-project-standards'],
      profile: 'ai-developer',
      orgProfile: 'techcon-ml',
      orgType: 'ml-pipeline',
      lang: 'en',
      registryPath,
    });
    const claudeMd = path.join(tmpDir, '.claude', 'CLAUDE.md');
    expect(fs.existsSync(claudeMd)).toBe(true);
    const content = fs.readFileSync(claudeMd, 'utf8');
    expect(content).toContain('ML Pipeline');
    expect(content).toContain('TechCon ML Team');
  });

  test('deployCore with --org-profile writes scaffold-meta with org fields', () => {
    deployCore(INFRA_DIR, tmpDir, {
      skills: ['python-project-standards'],
      profile: 'ai-developer',
      orgProfile: 'techcon-ml',
      orgType: 'ml-pipeline',
      lang: 'en',
      registryPath,
    });
    const metaPath = path.join(tmpDir, '.claude', '.scaffold-meta.json');
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(meta.org).toBe('techcon-ml');
    expect(meta.type).toBe('ml-pipeline');
    expect(meta.base_profile).toBe('ai-developer');
    expect(meta.scaffold_version).toBeDefined();
    expect(meta.deployed_at).toBeDefined();
  });

  test('deployCore without --org-profile writes scaffold-meta without org fields', () => {
    deployCore(INFRA_DIR, tmpDir, {
      skills: ['python-project-standards'],
      profile: 'ai-developer',
      lang: 'en',
      registryPath,
    });
    const metaPath = path.join(tmpDir, '.claude', '.scaffold-meta.json');
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(meta.org).toBeUndefined();
    expect(meta.type).toBeUndefined();
    expect(meta.base_profile).toBe('ai-developer');
  });
});
