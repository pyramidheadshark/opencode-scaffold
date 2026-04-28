'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { DEFAULT_SOURCES, loadSources, saveSources, addSource } = require('../../lib/registry/sources');
const { mergeIndices, isCacheStale, loadCache, saveCache } = require('../../lib/registry/cache');
const { verifySha256 } = require('../../lib/registry/download');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-registry-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('sources', () => {
  test('loadSources returns DEFAULT_SOURCES when file missing', () => {
    const result = loadSources(fs, path.join(tmpDir, 'nonexistent.json'));
    expect(result).toEqual(DEFAULT_SOURCES);
  });

  test('saveSources and loadSources roundtrip', () => {
    const sourcesPath = path.join(tmpDir, 'sources.json');
    const data = { version: '1.0', sources: [{ name: 'test', url: 'http://test.com', trust: 'community' }], cache_ttl_hours: 24 };
    saveSources(fs, sourcesPath, data);
    const loaded = loadSources(fs, sourcesPath);
    expect(loaded.sources).toHaveLength(1);
    expect(loaded.sources[0].name).toBe('test');
  });

  test('addSource adds new source', () => {
    const sourcesPath = path.join(tmpDir, 'sources.json');
    addSource(fs, sourcesPath, 'my-org', 'http://example.com/skills.json', 'community');
    const loaded = loadSources(fs, sourcesPath);
    const found = loaded.sources.find(s => s.name === 'my-org');
    expect(found).toBeDefined();
    expect(found.url).toBe('http://example.com/skills.json');
    expect(found.trust).toBe('community');
  });

  test('addSource updates existing source', () => {
    const sourcesPath = path.join(tmpDir, 'sources.json');
    addSource(fs, sourcesPath, 'test', 'http://old.com', 'community');
    addSource(fs, sourcesPath, 'test', 'http://new.com', 'verified');
    const loaded = loadSources(fs, sourcesPath);
    const testSources = loaded.sources.filter(s => s.name === 'test');
    expect(testSources).toHaveLength(1);
    expect(testSources[0].url).toBe('http://new.com');
    expect(testSources[0].trust).toBe('verified');
  });

  test('DEFAULT_SOURCES has scaffold-official as verified', () => {
    const official = DEFAULT_SOURCES.sources.find(s => s.name === 'scaffold-official');
    expect(official).toBeDefined();
    expect(official.trust).toBe('verified');
  });
});

describe('cache', () => {
  test('mergeIndices deduplicates by skill name', () => {
    const fetched = [
      { source: 'a', index: { skills: [{ name: 'foo', version: '1.0' }, { name: 'bar', version: '1.0' }] } },
      { source: 'b', index: { skills: [{ name: 'foo', version: '2.0' }, { name: 'baz', version: '1.0' }] } },
    ];
    const merged = mergeIndices(fetched);
    expect(merged).toHaveLength(3);
    const foo = merged.find(s => s.name === 'foo');
    expect(foo.version).toBe('1.0');
    expect(foo._source).toBe('a');
  });

  test('isCacheStale returns true when file missing', () => {
    expect(isCacheStale(fs, path.join(tmpDir, 'nope.json'), 168)).toBe(true);
  });

  test('isCacheStale returns false for fresh cache', () => {
    const cachePath = path.join(tmpDir, 'cache.json');
    fs.writeFileSync(cachePath, '{}', 'utf8');
    expect(isCacheStale(fs, cachePath, 168)).toBe(false);
  });

  test('saveCache and loadCache roundtrip', () => {
    const cachePath = path.join(tmpDir, 'sub', 'cache.json');
    const data = { skills: [{ name: 'test' }], updated: '2026-01-01' };
    saveCache(fs, cachePath, data);
    const loaded = loadCache(fs, cachePath);
    expect(loaded.skills).toHaveLength(1);
    expect(loaded.skills[0].name).toBe('test');
  });

  test('loadCache returns null for missing file', () => {
    expect(loadCache(fs, path.join(tmpDir, 'missing.json'))).toBeNull();
  });
});

describe('verifySha256', () => {
  test('returns true for matching hash', () => {
    const content = Buffer.from('hello world');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    expect(verifySha256(content, hash)).toBe(true);
  });

  test('returns false for mismatched hash', () => {
    const content = Buffer.from('hello world');
    expect(verifySha256(content, 'deadbeef')).toBe(false);
  });

  test('detects tampering', () => {
    const original = Buffer.from('trusted content');
    const hash = crypto.createHash('sha256').update(original).digest('hex');
    const tampered = Buffer.from('tampered content');
    expect(verifySha256(tampered, hash)).toBe(false);
  });
});

describe('validation', () => {
  const { runRegistryInstall, runRegistryAddSource } = require('../../lib/commands/registry');

  beforeEach(() => {
    const regDir = path.join(tmpDir, 'registry');
    const cacheDir = path.join(regDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(regDir, 'sources.json'),
      JSON.stringify({ version: '1.0', sources: [], cache_ttl_hours: 168 }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(cacheDir, 'registry-index.json'),
      JSON.stringify({ updated: new Date().toISOString(), skills: [] }),
      'utf8'
    );
  });

  test('rejects skill name with path traversal', async () => {
    await expect(runRegistryInstall(tmpDir, tmpDir, '../../../etc/passwd'))
      .rejects.toThrow('Invalid skill name');
  });

  test('rejects skill name with slashes', async () => {
    await expect(runRegistryInstall(tmpDir, tmpDir, 'foo/bar'))
      .rejects.toThrow('Invalid skill name');
  });

  test('accepts valid skill name characters', async () => {
    await expect(runRegistryInstall(tmpDir, tmpDir, 'my-valid.skill_v2'))
      .rejects.toThrow('not found in registry');
  });

  test('rejects invalid URL scheme in add-source', async () => {
    await expect(runRegistryAddSource(tmpDir, 'bad', 'file:///etc/passwd'))
      .rejects.toThrow('Invalid URL scheme');
  });

  test('rejects invalid trust level', async () => {
    await expect(runRegistryAddSource(tmpDir, 'test', 'https://example.com/reg.json', { trust: 'malicious' }))
      .rejects.toThrow('Invalid trust level');
  });
});

describe('registry/skills.json', () => {
  const REGISTRY_PATH = path.resolve(__dirname, '../../registry/skills.json');

  test('registry index is valid JSON', () => {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    expect(data.version).toBe('1.0');
    expect(Array.isArray(data.skills)).toBe(true);
  });

  test('all skills have required fields', () => {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    for (const skill of data.skills) {
      expect(skill.name).toBeDefined();
      expect(skill.version).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.sha256).toBeDefined();
      expect(skill.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(skill.trust).toBe('verified');
      expect(skill.source_url).toContain('pyramidheadshark/claude-scaffold');
    }
  });

  test('registry has 22 skills', () => {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    expect(data.skills.length).toBe(22);
  });

  test('skill names are unique in registry', () => {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const names = data.skills.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('sha256 hashes match actual SKILL.md files', () => {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const skillsBase = path.resolve(__dirname, '../../.claude/skills');
    for (const skill of data.skills) {
      const mdPath = path.join(skillsBase, skill.name, 'SKILL.md');
      if (!fs.existsSync(mdPath)) continue;
      const content = fs.readFileSync(mdPath);
      const actual = crypto.createHash('sha256').update(content).digest('hex');
      expect(actual).toBe(skill.sha256);
    }
  });
});
