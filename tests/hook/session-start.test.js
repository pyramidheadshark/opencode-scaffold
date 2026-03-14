const path = require("path");
const os = require("os");
const fs = require("fs");
const { main, buildEnvBlock, loadConfig, saveConfig, ONBOARDING_BLOCK, WINDOWS_RULES_BLOCK, buildLocalizedBlocks } = require("../../.claude/hooks/session-start");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-start-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("buildEnvBlock", () => {
  test("returns formatted env block string", () => {
    const block = buildEnvBlock("win32", "python", "bash", 3);
    expect(block).toBe("## Session Environment\nPlatform: win32 | Shell: bash | Python: python | Sessions: 3");
  });

  test("contains all four fields", () => {
    const block = buildEnvBlock("linux", "python3", "zsh", 1);
    expect(block).toContain("linux");
    expect(block).toContain("python3");
    expect(block).toContain("zsh");
    expect(block).toContain("Sessions: 1");
  });
});

describe("loadConfig / saveConfig", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("loadConfig returns null when no config exists", () => {
    expect(loadConfig(tmpDir)).toBeNull();
  });

  test("saveConfig creates .claude dir and writes file", () => {
    saveConfig(tmpDir, { platform: "win32", session_count: 1 });
    const configPath = path.join(tmpDir, ".claude/project-config.json");
    expect(fs.existsSync(configPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
    expect(data.platform).toBe("win32");
  });

  test("loadConfig reads written config back", () => {
    saveConfig(tmpDir, { session_count: 5 });
    const config = loadConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config.session_count).toBe(5);
  });
});

describe("main — first run (no config)", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("returns continue:true", () => {
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.continue).toBe(true);
  });

  test("returns env block in system_prompt_addition", () => {
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.system_prompt_addition).toContain("## Session Environment");
    expect(result.system_prompt_addition).toContain("win32");
  });

  test("includes onboarding block on first run", () => {
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.system_prompt_addition).toContain("## Project Onboarding Required");
    expect(result.system_prompt_addition).toContain("project-config.json");
  });

  test("creates project-config.json with session_count=1", () => {
    main("{}", tmpDir, "linux", () => "python3");
    const config = loadConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config.session_count).toBe(1);
    expect(config.platform).toBe("linux");
    expect(config.python_cmd).toBe("python3");
  });
});

describe("main — subsequent runs (config exists)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
    saveConfig(tmpDir, { platform: "win32", python_cmd: "python", shell: "bash", session_count: 4 });
  });
  afterEach(() => { cleanup(tmpDir); });

  test("env block present without onboarding block", () => {
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.system_prompt_addition).toContain("## Session Environment");
    expect(result.system_prompt_addition).not.toContain("## Project Onboarding Required");
  });

  test("increments session_count", () => {
    main("{}", tmpDir, "win32", () => "python");
    const config = loadConfig(tmpDir);
    expect(config.session_count).toBe(5);
  });
});

describe("WINDOWS_RULES_BLOCK", () => {
  test("is exported and non-empty", () => {
    expect(typeof WINDOWS_RULES_BLOCK).toBe("string");
    expect(WINDOWS_RULES_BLOCK.length).toBeGreaterThan(0);
  });

  test("contains all three rule areas", () => {
    expect(WINDOWS_RULES_BLOCK).toContain("python");
    expect(WINDOWS_RULES_BLOCK).toContain("PowerShell");
    expect(WINDOWS_RULES_BLOCK).toContain('encoding="utf-8"');
  });

  test("contains chcp 65001 instruction", () => {
    expect(WINDOWS_RULES_BLOCK).toContain("chcp 65001");
  });
});

describe("main — Windows rules injection", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("injects Windows rules on win32", () => {
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.system_prompt_addition).toContain("## Windows Compatibility Rules");
  });

  test("does NOT inject Windows rules on linux", () => {
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).not.toContain("## Windows Compatibility Rules");
  });

  test("Windows rules injected on all win32 sessions, not just first", () => {
    saveConfig(tmpDir, { platform: "win32", python_cmd: "python", shell: "bash", session_count: 2 });
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.system_prompt_addition).toContain("## Windows Compatibility Rules");
  });
});

describe("i18n — buildLocalizedBlocks", () => {
  test("en returns English onboarding title", () => {
    const blocks = buildLocalizedBlocks("en");
    expect(blocks.onboarding).toContain("## Project Onboarding Required");
  });

  test("ru returns Russian onboarding title", () => {
    const blocks = buildLocalizedBlocks("ru");
    expect(blocks.onboarding).toContain("## Требуется онбординг проекта");
  });

  test("en returns English windows block", () => {
    const blocks = buildLocalizedBlocks("en");
    expect(blocks.windows).toContain("## Windows Compatibility Rules");
  });

  test("ru returns Russian windows block", () => {
    const blocks = buildLocalizedBlocks("ru");
    expect(blocks.windows).toContain("## Правила совместимости с Windows");
  });

  test("undefined lang defaults to English", () => {
    const blocks = buildLocalizedBlocks(undefined);
    expect(blocks.onboarding).toContain("## Project Onboarding Required");
  });
});

describe("main — RU localization", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-start-ru-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("uses Russian onboarding when lang=ru and session_count=0 in config", () => {
    saveConfig(tmpDir, { platform: "linux", python_cmd: "python3", shell: "bash", session_count: 0, lang: "ru" });
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).toContain("## Требуется онбординг проекта");
  });

  test("uses Russian windows block when lang=ru on win32", () => {
    saveConfig(tmpDir, { platform: "win32", python_cmd: "python", shell: "bash", session_count: 0, lang: "ru" });
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.system_prompt_addition).toContain("## Правила совместимости с Windows");
  });

  test("subsequent session lang=ru still uses Russian windows block", () => {
    saveConfig(tmpDir, { platform: "win32", python_cmd: "python", shell: "bash", session_count: 3, lang: "ru" });
    const result = main("{}", tmpDir, "win32", () => "python");
    expect(result.system_prompt_addition).toContain("## Правила совместимости с Windows");
    expect(result.system_prompt_addition).not.toContain("## Требуется онбординг проекта");
  });
});

describe("detectPythonCmd — win32 shortcut", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("returns 'python' on win32 without attempting execSync", () => {
    const result = main("{}", tmpDir, "win32", null);
    const config = loadConfig(tmpDir);
    expect(config.python_cmd).toBe("python");
    expect(result.system_prompt_addition).toContain("Python: python");
  });
});

describe("main — edge cases", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("handles empty input string gracefully", () => {
    expect(() => main("", tmpDir, "win32", () => "python")).not.toThrow();
  });

  test("handles invalid JSON input gracefully", () => {
    expect(() => main("{invalid}", tmpDir, "win32", () => "python")).not.toThrow();
  });
});
