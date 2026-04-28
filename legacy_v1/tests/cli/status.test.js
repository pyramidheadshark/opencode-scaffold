'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const INFRA_DIR = path.join(__dirname, '..', '..');
const { getStatusReport } = require('../../lib/commands/status');
const { getCurrentSha } = require('../../lib/deploy/git');

let tmpDir;
let registryPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-status-'));
  registryPath = path.join(os.tmpdir(), `cs-test-reg-${Date.now()}.json`);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
});

describe('status — getStatusReport', () => {
  test('returns empty array when no repos registered', () => {
    fs.writeFileSync(registryPath, JSON.stringify({ deployed: [] }), 'utf8');
    const report = getStatusReport(INFRA_DIR, registryPath);
    expect(report.entries).toHaveLength(0);
  });

  test('detects up-to-date repo', () => {
    const currentSha = getCurrentSha(INFRA_DIR);

    const versionFile = path.join(tmpDir, '.claude', 'infra-version');
    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
    fs.writeFileSync(versionFile, currentSha, 'utf8');

    const registry = {
      deployed: [{
        path: tmpDir,
        skills: ['python-project-standards'],
        ci_profile: 'minimal',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: currentSha,
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const report = getStatusReport(INFRA_DIR, registryPath);
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0].status).toBe('up to date');
    expect(report.entries[0].skills).toContain('python-project-standards');
  });

  test('detects outdated repo', () => {
    const versionFile = path.join(tmpDir, '.claude', 'infra-version');
    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
    fs.writeFileSync(versionFile, 'old_sha_xyz', 'utf8');

    const registry = {
      deployed: [{
        path: tmpDir,
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'old_sha_xyz',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const report = getStatusReport(INFRA_DIR, registryPath);
    expect(report.entries[0].status).toMatch(/OUTDATED/);
  });

  test('marks not-found path', () => {
    const registry = {
      deployed: [{
        path: '/does/not/exist/at/all',
        skills: ['python-project-standards'],
        ci_profile: '',
        deploy_target: 'none',
        deployed_at: '2025-01-01',
        infra_sha: 'abc',
      }],
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const report = getStatusReport(INFRA_DIR, registryPath);
    expect(report.entries[0].status).toMatch(/NOT FOUND/);
  });

  test('includes currentSha in report', () => {
    fs.writeFileSync(registryPath, JSON.stringify({ deployed: [] }), 'utf8');
    const report = getStatusReport(INFRA_DIR, registryPath);
    expect(report.currentSha).toBeTruthy();
    expect(typeof report.currentSha).toBe('string');
  });
});
