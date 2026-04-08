const path = require("path");
const os = require("os");
const fs = require("fs");
const { main, buildEnvBlock, loadConfig, saveConfig, parseSimpleYaml, buildDepsBlock, buildInfraBlock, ONBOARDING_BLOCK, WINDOWS_RULES_BLOCK, buildLocalizedBlocks, LIGHT_AGENTS_BLOCK } = require("../../.claude/hooks/session-start");

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

describe("parseSimpleYaml", () => {
  test("parses flat key-value pairs", () => {
    const result = parseSimpleYaml("project: my-project\nversion: 1.0");
    expect(result.project).toBe("my-project");
    expect(result.version).toBe("1.0");
  });

  test("parses list of objects", () => {
    const yaml = `depends_on:\n  - repo: hub\n    type: knowledge\n  - repo: infra\n    type: infrastructure`;
    const result = parseSimpleYaml(yaml);
    expect(result.depends_on).toHaveLength(2);
    expect(result.depends_on[0].repo).toBe("hub");
    expect(result.depends_on[1].type).toBe("infrastructure");
  });

  test("parses list of strings (rules)", () => {
    const yaml = `rules:\n  - "Never do X"\n  - "Always do Y"`;
    const result = parseSimpleYaml(yaml);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0]).toBe("Never do X");
  });

  test("ignores comments", () => {
    const result = parseSimpleYaml("# comment\nproject: test");
    expect(result.project).toBe("test");
  });
});

describe("buildDepsBlock", () => {
  test("returns null when no deps.yaml", () => {
    const mockFs = { existsSync: () => false };
    expect(buildDepsBlock(mockFs, "/tmp")).toBeNull();
  });

  test("returns deps block when deps.yaml exists", () => {
    const yaml = `project: test\ndepends_on:\n  - repo: hub\n    type: knowledge\n    description: "KB"\nblockers:\n  - id: B1\n    description: "Issue"\n    status: open\n    since: "2026-01-01"`;
    const mockFs = {
      existsSync: () => true,
      readFileSync: () => yaml,
    };
    const result = buildDepsBlock(mockFs, "/tmp");
    expect(result).toContain("DEPENDENCIES");
    expect(result).toContain("hub");
    expect(result).toContain("B1");
    expect(result).toContain("Open Blockers");
  });
});

describe("buildInfraBlock", () => {
  test("returns null when no INFRA.yaml", () => {
    const mockFs = { existsSync: () => false };
    expect(buildInfraBlock(mockFs, "/tmp")).toBeNull();
  });

  test("returns infra block with rules", () => {
    const yaml = `rules:\n  - "Never use public IP"\n  - "Verify VPC IP"`;
    const mockFs = {
      existsSync: (p) => p.includes("INFRA.yaml"),
      readFileSync: () => yaml,
    };
    const result = buildInfraBlock(mockFs, "/tmp");
    expect(result).toContain("INFRASTRUCTURE");
    expect(result).toContain("Never use public IP");
  });
});

describe("main — deps/infra injection", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("injects deps block when deps.yaml exists", () => {
    fs.writeFileSync(path.join(tmpDir, "deps.yaml"), "project: test\ndepends_on:\n  - repo: hub\n    type: knowledge\n    description: KB", "utf8");
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).toContain("DEPENDENCIES");
    expect(result.system_prompt_addition).toContain("hub");
  });

  test("does not inject deps when no deps.yaml", () => {
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).not.toContain("DEPENDENCIES");
  });
});

describe("main — SCAFFOLD_LIGHT_AGENTS", () => {
  let tmpDir;
  const ORIG_ENV = process.env.SCAFFOLD_LIGHT_AGENTS;

  beforeEach(() => {
    tmpDir = makeTempDir();
    delete process.env.SCAFFOLD_LIGHT_AGENTS;
  });
  afterEach(() => {
    cleanup(tmpDir);
    if (ORIG_ENV !== undefined) process.env.SCAFFOLD_LIGHT_AGENTS = ORIG_ENV;
    else delete process.env.SCAFFOLD_LIGHT_AGENTS;
  });

  test("injects light agents block when SCAFFOLD_LIGHT_AGENTS=true", () => {
    process.env.SCAFFOLD_LIGHT_AGENTS = "true";
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).toContain("Light Agents Active");
    expect(result.system_prompt_addition).toContain("status-updater");
  });

  test("injects light agents block when SCAFFOLD_LIGHT_AGENTS=1", () => {
    process.env.SCAFFOLD_LIGHT_AGENTS = "1";
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).toContain("Light Agents Active");
  });

  test("does not inject when SCAFFOLD_LIGHT_AGENTS not set", () => {
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).not.toContain("Light Agents Active");
  });

  test("does not inject when SCAFFOLD_LIGHT_AGENTS=false", () => {
    process.env.SCAFFOLD_LIGHT_AGENTS = "false";
    const result = main("{}", tmpDir, "linux", () => "python3");
    expect(result.system_prompt_addition).not.toContain("Light Agents Active");
  });

  test("LIGHT_AGENTS_BLOCK export contains status-updater reference", () => {
    expect(LIGHT_AGENTS_BLOCK).toContain("status-updater");
    expect(LIGHT_AGENTS_BLOCK).toContain("Light Agents Active");
  });
});
