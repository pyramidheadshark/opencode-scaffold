'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { runDepsStatus, runDepsUpdateBlocker, runDepsAdd, runDepsRemove, loadDeps, saveDeps } = require('../../lib/commands/deps');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-deps-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SAMPLE_DEPS = `project: test-project

depends_on:
  - repo: my-hub
    type: knowledge
    description: "Knowledge base"
  - repo: my-infra
    type: infrastructure
    description: "Terraform configs"

blockers:
  - id: BLK-001
    description: "Latency issue"
    status: open
    since: "2026-03-15"
  - id: BLK-002
    description: "Fixed issue"
    status: resolved
    since: "2026-02-01"
`;

describe('loadDeps', () => {
  test('returns null when no deps.yaml', () => {
    expect(loadDeps(tmpDir)).toBeNull();
  });

  test('parses deps.yaml correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'deps.yaml'), SAMPLE_DEPS, 'utf8');
    const deps = loadDeps(tmpDir);
    expect(deps.project).toBe('test-project');
    expect(deps.depends_on).toHaveLength(2);
    expect(deps.depends_on[0].repo).toBe('my-hub');
    expect(deps.depends_on[0].type).toBe('knowledge');
    expect(deps.blockers).toHaveLength(2);
    expect(deps.blockers[0].id).toBe('BLK-001');
    expect(deps.blockers[0].status).toBe('open');
  });
});

describe('runDepsAdd', () => {
  test('creates deps.yaml if not exists', () => {
    runDepsAdd(tmpDir, 'new-repo', { type: 'infrastructure' });
    const deps = loadDeps(tmpDir);
    expect(deps.depends_on).toHaveLength(1);
    expect(deps.depends_on[0].repo).toBe('new-repo');
    expect(deps.depends_on[0].type).toBe('infrastructure');
  });

  test('adds to existing deps', () => {
    fs.writeFileSync(path.join(tmpDir, 'deps.yaml'), SAMPLE_DEPS, 'utf8');
    runDepsAdd(tmpDir, 'new-repo', { type: 'data' });
    const deps = loadDeps(tmpDir);
    expect(deps.depends_on.length).toBeGreaterThanOrEqual(3);
    const added = deps.depends_on.find(d => d.repo === 'new-repo');
    expect(added).toBeDefined();
    expect(added.type).toBe('data');
  });
});

describe('runDepsRemove', () => {
  test('removes existing dependency', () => {
    fs.writeFileSync(path.join(tmpDir, 'deps.yaml'), SAMPLE_DEPS, 'utf8');
    runDepsRemove(tmpDir, 'my-hub');
    const deps = loadDeps(tmpDir);
    const found = deps.depends_on.find(d => d.repo === 'my-hub');
    expect(found).toBeUndefined();
  });
});

describe('runDepsUpdateBlocker', () => {
  test('updates blocker status to resolved', () => {
    fs.writeFileSync(path.join(tmpDir, 'deps.yaml'), SAMPLE_DEPS, 'utf8');
    runDepsUpdateBlocker(tmpDir, 'BLK-001', { status: 'resolved' });
    const deps = loadDeps(tmpDir);
    const b = deps.blockers.find(b => b.id === 'BLK-001');
    expect(b.status).toBe('resolved');
  });
});

describe('runDepsStatus', () => {
  test('runs without error on sample deps', () => {
    fs.writeFileSync(path.join(tmpDir, 'deps.yaml'), SAMPLE_DEPS, 'utf8');
    expect(() => runDepsStatus(tmpDir)).not.toThrow();
  });

  test('runs without error when no deps.yaml', () => {
    expect(() => runDepsStatus(tmpDir)).not.toThrow();
  });
});
