'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const INFRA_DIR = path.join(__dirname, '..', '..');
const { deployCore } = require('../../lib/commands/init');
const { updateOne, updateAll } = require('../../lib/commands/update');

let tmpDir;
let tmpDir2;
let registryPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-upd1-'));
  tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-upd2-'));
  registryPath = path.join(os.tmpdir(), `cs-test-registry-${Date.now()}.json`);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(tmpDir2, { recursive: true, force: true });
  if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
});

describe('update — updateOne', () => {
  test('updates .claude/ in registered repo', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });

    const registry = {
      deployed: [{
        path: tmpDir,
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'old_sha',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    updateOne(INFRA_DIR, tmpDir, registryPath);

    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'python-project-standards'))).toBe(true);
  });

  test('throws if target not in registry', () => {
    fs.writeFileSync(registryPath, JSON.stringify({ deployed: [] }), 'utf8');
    expect(() => updateOne(INFRA_DIR, tmpDir, registryPath)).toThrow();
  });

  test('updateOne actually rewrites hooks content (not just counters)', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });
    const hookPath = path.join(tmpDir, '.claude', 'hooks', 'skill-activation-prompt.js');
    fs.writeFileSync(hookPath, '// outdated', 'utf8');

    const registry = {
      deployed: [{
        path: tmpDir,
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'old',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    updateOne(INFRA_DIR, tmpDir, registryPath);
    expect(fs.readFileSync(hookPath, 'utf8')).not.toBe('// outdated');
  });

  test('does not overwrite CI workflows', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });

    const workflowsDir = path.join(tmpDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    const ciPath = path.join(workflowsDir, 'ci.yml');
    fs.writeFileSync(ciPath, '# existing CI', 'utf8');

    const registry = {
      deployed: [{
        path: tmpDir,
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'old_sha',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    updateOne(INFRA_DIR, tmpDir, registryPath);

    expect(fs.readFileSync(ciPath, 'utf8')).toBe('# existing CI');
  });
});

describe('update — updateAll', () => {
  test('skips already up-to-date repos', () => {
    const { getCurrentSha } = require('../../lib/deploy/git');
    const currentSha = getCurrentSha(INFRA_DIR);

    const versionFile = path.join(tmpDir, '.claude', 'infra-version');
    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
    fs.writeFileSync(versionFile, currentSha, 'utf8');

    const registry = {
      deployed: [{
        path: tmpDir,
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: currentSha,
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const result = updateAll(INFRA_DIR, registryPath);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('skips repos where path does not exist on disk', () => {
    const registry = {
      deployed: [{
        path: '/does/not/exist/on/disk/anywhere',
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'old_sha_gone',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const result = updateAll(INFRA_DIR, registryPath);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('logs skipped path to stderr when directory not found', () => {
    const missingPath = '/does/not/exist/for/stderr/test';
    const registry = {
      deployed: [{
        path: missingPath,
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'old_sha',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const stderrChunks = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk, ...args) => { stderrChunks.push(chunk); return origWrite(chunk, ...args); };
    try {
      updateAll(INFRA_DIR, registryPath);
    } finally {
      process.stderr.write = origWrite;
    }
    const output = stderrChunks.join('');
    expect(output).toContain(missingPath);
  });

  test('updates outdated repos', () => {
    deployCore(INFRA_DIR, tmpDir, { skills: ['python-project-standards'], registryPath });

    const versionFile = path.join(tmpDir, '.claude', 'infra-version');
    fs.writeFileSync(versionFile, 'old_sha_abc', 'utf8');

    const registry = {
      deployed: [{
        path: tmpDir,
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'old_sha_abc',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const result = updateAll(INFRA_DIR, registryPath);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
