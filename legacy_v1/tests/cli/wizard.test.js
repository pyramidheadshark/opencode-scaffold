'use strict';

jest.mock('readline');

const readline = require('readline');
const { runWizard } = require('../../lib/ui/wizard');

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
});

afterEach(() => {
  jest.clearAllMocks();
});

function setupReadline(answers) {
  let idx = 0;
  const rl = {
    question: jest.fn((prompt, cb) => cb(answers[idx++] ?? '')),
    close: jest.fn(),
  };
  readline.createInterface.mockReturnValue(rl);
  return rl;
}

describe('runWizard', () => {
  test('profile selection — fastapi-developer (index 3)', async () => {
    setupReadline(['/project', '3', '1', '0']);
    const result = await runWizard();
    expect(result.profileName).toBe('fastapi-developer');
    expect(result.targetPath).toBe('/project');
  });

  test('invalid profile index falls through to custom skills prompt', async () => {
    setupReadline(['/project', '9', 'python-project-standards, fastapi-patterns', '1', '0']);
    const result = await runWizard();
    expect(result.profileName).toBe('');
    expect(result.skills).toEqual(['python-project-standards', 'fastapi-patterns']);
  });

  test('custom skills via index 0', async () => {
    setupReadline(['/project', '0', 'test-first-patterns', '1', '0']);
    const result = await runWizard();
    expect(result.skills).toEqual(['test-first-patterns']);
    expect(result.profileName).toBe('');
  });

  test('language choice EN (1)', async () => {
    setupReadline(['/project', '1', '1', '0']);
    const result = await runWizard();
    expect(result.lang).toBe('en');
  });

  test('language choice RU (2)', async () => {
    setupReadline(['/project', '1', '2', '0']);
    const result = await runWizard();
    expect(result.lang).toBe('ru');
  });

  test('unknown language defaults to en', async () => {
    setupReadline(['/project', '1', '3', '0']);
    const result = await runWizard();
    expect(result.lang).toBe('en');
  });

  test('CI profile ml-heavy (index 4)', async () => {
    setupReadline(['/project', '1', '1', '4', '1']);
    const result = await runWizard();
    expect(result.ciProfile).toBe('ml-heavy');
  });

  test('CI profile skip (0) — ciProfile empty string', async () => {
    setupReadline(['/project', '1', '1', '0']);
    const result = await runWizard();
    expect(result.ciProfile).toBe('');
    expect(result.deployTarget).toBe('none');
  });

  test('deploy target VPS (index 3)', async () => {
    setupReadline(['/project', '1', '1', '1', '3']);
    const result = await runWizard();
    expect(result.deployTarget).toBe('vps');
  });

  test('deploy target yc (index 2)', async () => {
    setupReadline(['/project', '1', '1', '1', '2']);
    const result = await runWizard();
    expect(result.deployTarget).toBe('yc');
  });

  test('full wizard flow — ml-engineer, ru, minimal CI, no deploy', async () => {
    setupReadline(['/my/project', '1', '2', '1', '1']);
    const result = await runWizard();
    expect(result).toMatchObject({
      targetPath: '/my/project',
      profileName: 'ml-engineer',
      lang: 'ru',
      ciProfile: 'minimal',
      deployTarget: 'none',
    });
    expect(result.skills.length).toBeGreaterThan(0);
  });

  test('rl.close called after wizard completes', async () => {
    const rl = setupReadline(['/project', '1', '1', '0']);
    await runWizard();
    expect(rl.close).toHaveBeenCalledTimes(1);
  });
});
