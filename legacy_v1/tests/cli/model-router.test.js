'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock ccr-config so tests use legacy path (no CCR config present)
jest.mock('../../lib/ccr-config', () => ({
  OPENROUTER_MODEL_PRESETS: {
    deepseek: { model: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'DeepSeek V4 Flash' },
    glm: { model: 'z-ai/glm-5.1', label: 'GLM 5.1', description: 'GLM 5.1' },
    kimi: { model: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', description: 'Kimi K2.6' },
    sonnet: { model: 'anthropic/claude-sonnet-4.6', label: 'Sonnet 4.6 (OR)', description: 'Sonnet 4.6 via OpenRouter' },
    opus: { model: 'anthropic/claude-opus-4.7', label: 'Opus 4.7 (OR)', description: 'Opus 4.7 via OpenRouter' },
    haiku: { model: 'anthropic/claude-haiku-4.5', label: 'Haiku 4.5 (OR)', description: 'Haiku 4.5 via OpenRouter' },
    gemini: { model: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Gemini 2.5 Pro' },
    'gemini-flash': { model: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Gemini 2.5 Flash' },
    mixed: { model: null, label: 'Mixed', description: 'Mixed mode', isMixed: true },
  },
  readCCRConfig: jest.fn(() => null),
  updateCCRRouter: jest.fn(() => true),
  writeScaffoldMode: jest.fn(),
  restartCCR: jest.fn(() => Promise.resolve(true)),
  getCCRConfigPath: jest.fn(),
  isCCRConfigured: jest.fn(() => false),
}));

const {
  PROFILES,
  PRESETS,
  getConfigPath,
  ALIAS_START,
  ALIAS_END,
  use,
  installAliases,
  getActiveProfile,
  buildAliasBlock,
} = require('../../lib/commands/model-router');

let tmpHome;
let originalConfigPath;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-mr-test-'));
  jest.spyOn(os, 'homedir').mockReturnValue(tmpHome);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function getLocalConfigPath() {
  return path.join(tmpHome, '.claude', 'model-config.json');
}

function getEnvShPath(profileName) {
  return path.join(tmpHome, '.claude', `scaffold-env-${profileName}.sh`);
}

function getEnvPs1Path(profileName) {
  return path.join(tmpHome, '.claude', `scaffold-env-${profileName}.ps1`);
}

describe('PROFILES and PRESETS constants', () => {
  test('PROFILES contains exactly the 5 expected profiles', () => {
    expect(Object.keys(PROFILES)).toEqual(['sonnet', 'haiku', 'opus', 'gemini-flash', 'gemini-pro']);
  });

  test('PRESETS resolves to valid profile names', () => {
    for (const [preset, target] of Object.entries(PRESETS)) {
      expect(PROFILES[target]).toBeDefined();
    }
  });
});

describe('MR-01: use sonnet writes correct model-config.json', () => {
  test('model-config.json contains profile, model, provider', () => {
    use('sonnet');
    const configPath = getConfigPath();
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.profile).toBe('sonnet');
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-6');
    expect(config.updatedAt).toBeDefined();
  });
});

describe('MR-02: use gemini-flash writes correct ANTHROPIC_BASE_URL', () => {
  test('env file contains ANTHROPIC_BASE_URL=https://openrouter.ai/api (NOT /api/v1)', () => {
    use('gemini-flash');
    const shPath = getEnvShPath('gemini-flash');
    expect(fs.existsSync(shPath)).toBe(true);
    const content = fs.readFileSync(shPath, 'utf8');
    expect(content).toContain('ANTHROPIC_BASE_URL="https://openrouter.ai/api"');
    expect(content).not.toContain('/api/v1');
  });

  test('env file uses LF line endings (not CRLF)', () => {
    use('gemini-flash');
    const shPath = getEnvShPath('gemini-flash');
    const raw = fs.readFileSync(shPath, 'utf8');
    expect(raw).not.toContain('\r\n');
  });
});

describe('MR-03: use gemini-flash uses ANTHROPIC_AUTH_TOKEN not ANTHROPIC_API_KEY', () => {
  test('env file contains ANTHROPIC_AUTH_TOKEN', () => {
    use('gemini-flash');
    const shPath = getEnvShPath('gemini-flash');
    const content = fs.readFileSync(shPath, 'utf8');
    expect(content).toContain('ANTHROPIC_AUTH_TOKEN');
  });

  test('env file does not assign ANTHROPIC_API_KEY (only explicitly empties it)', () => {
    use('gemini-flash');
    const shPath = getEnvShPath('gemini-flash');
    const content = fs.readFileSync(shPath, 'utf8');
    const lines = content.split('\n');
    const apiKeyAssignment = lines.find(
      l => l.startsWith('export ANTHROPIC_API_KEY=') && l !== 'export ANTHROPIC_API_KEY=""'
    );
    expect(apiKeyAssignment).toBeUndefined();
    expect(content).toContain('ANTHROPIC_API_KEY=""');
  });
});

describe('MR-04: use executor resolves to gemini-flash profile', () => {
  test('executor preset resolves to gemini-flash', () => {
    use('executor');
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    expect(config.profile).toBe('gemini-flash');
    expect(config.provider).toBe('openrouter');
  });

  test('architect preset resolves to opus', () => {
    use('architect');
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    expect(config.profile).toBe('opus');
    expect(config.provider).toBe('anthropic');
  });

  test('critic preset resolves to sonnet', () => {
    use('critic');
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    expect(config.profile).toBe('sonnet');
  });
});

describe('MR-05: installAliases idempotency via marker block', () => {
  test('marker appears exactly once after double install', () => {
    const bashrcPath = path.join(tmpHome, '.bashrc');
    installAliases();
    installAliases();
    const content = fs.readFileSync(bashrcPath, 'utf8');
    const startCount = (content.match(new RegExp(ALIAS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const endCount = (content.match(new RegExp(ALIAS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    expect(startCount).toBe(1);
    expect(endCount).toBe(1);
  });

  test('all profile aliases are present after install', () => {
    const bashrcPath = path.join(tmpHome, '.bashrc');
    installAliases();
    const content = fs.readFileSync(bashrcPath, 'utf8');
    for (const profileName of Object.keys(PROFILES)) {
      expect(content).toContain(`alias claude-${profileName}=`);
    }
  });

  test('does not duplicate aliases when existing content preserved', () => {
    const bashrcPath = path.join(tmpHome, '.bashrc');
    fs.writeFileSync(bashrcPath, '# my custom stuff\nexport FOO=bar\n', 'utf8');
    installAliases();
    const content = fs.readFileSync(bashrcPath, 'utf8');
    expect(content).toContain('# my custom stuff');
    expect(content).toContain('export FOO=bar');
    expect(content).toContain(ALIAS_START);
  });
});

describe('MR-06: use gemini-flash warns about experimental status', () => {
  test('stdout contains warning and Experimental', () => {
    use('gemini-flash');
    const logCalls = console.log.mock.calls.flat().join('\n');
    expect(logCalls).toContain('⚠');
    expect(logCalls).toContain('Experimental');
  });

  test('use sonnet does not warn about experimental', () => {
    use('sonnet');
    const logCalls = console.log.mock.calls.flat().join('\n');
    expect(logCalls).not.toContain('Experimental');
  });
});

describe('MR-07: use unknown-xyz exits with code 1', () => {
  test('unknown profile causes process.exit(1)', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    expect(() => use('unknown-xyz')).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  test('error message lists available profiles', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    try { use('unknown-xyz'); } catch {}
    const errorCalls = console.error.mock.calls.flat().join('\n');
    expect(errorCalls).toContain('sonnet');
    expect(errorCalls).toContain('gemini-flash');
    exitSpy.mockRestore();
  });
});

describe('MR-08: getActiveProfile returns null when no config file', () => {
  test('returns null when config file does not exist', () => {
    const result = getActiveProfile();
    expect(result).toBeNull();
  });

  test('returns null when config file is corrupted JSON', () => {
    const claudeDir = path.join(tmpHome, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'model-config.json'), 'not valid json', 'utf8');
    const result = getActiveProfile();
    expect(result).toBeNull();
  });

  test('returns config object when valid config exists', () => {
    use('sonnet');
    const result = getActiveProfile();
    expect(result).not.toBeNull();
    expect(result.profile).toBe('sonnet');
  });
});

describe('MR-09: use gemini-flash generates .ps1 file', () => {
  test('ps1 file is generated for openrouter profiles', () => {
    use('gemini-flash');
    const ps1Path = getEnvPs1Path('gemini-flash');
    expect(fs.existsSync(ps1Path)).toBe(true);
  });

  test('ps1 file contains correct OpenRouter env vars', () => {
    use('gemini-flash');
    const ps1Path = getEnvPs1Path('gemini-flash');
    const content = fs.readFileSync(ps1Path, 'utf8');
    expect(content).toContain('ANTHROPIC_BASE_URL');
    expect(content).toContain('https://openrouter.ai/api');
    expect(content).toContain('ANTHROPIC_AUTH_TOKEN');
  });

  test('ps1 file is not generated for anthropic profiles', () => {
    jest.spyOn(os, 'platform').mockReturnValue('linux');
    use('haiku');
    const ps1Path = getEnvPs1Path('haiku');
    expect(fs.existsSync(ps1Path)).toBe(false);
    os.platform.mockRestore();
  });
});

describe('buildAliasBlock', () => {
  test('contains all profile names', () => {
    const block = buildAliasBlock();
    for (const name of Object.keys(PROFILES)) {
      expect(block).toContain(`claude-${name}`);
    }
  });

  test('starts with ALIAS_START and ends with ALIAS_END', () => {
    const block = buildAliasBlock();
    expect(block.startsWith(ALIAS_START)).toBe(true);
    expect(block.endsWith(ALIAS_END)).toBe(true);
  });
});
