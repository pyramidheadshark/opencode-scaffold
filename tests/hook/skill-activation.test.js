const path = require("path");
const { simpleHash, loadSkillRules, loadStatusContent, getSkillSize, matchSkills, loadSkillContent, extractRelevantPitfalls, buildInjections, buildOutput } = require("../../.claude/hooks/skill-activation-logic");

const FIXTURE_WITH_STATUS = path.join(__dirname, "../fixtures/project-with-status");

function mockFs(files = {}) {
  const normalize = (p) => p.replace(/\\/g, "/");
  const normalizedFiles = {};
  for (const [k, v] of Object.entries(files)) normalizedFiles[normalize(k)] = v;
  return {
    existsSync: (p) => normalize(p) in normalizedFiles,
    readFileSync: (p, enc) => {
      const key = normalize(p);
      if (!(key in normalizedFiles)) throw new Error(`File not found: ${p}`);
      return normalizedFiles[key];
    },
  };
}

const MINIMAL_RULES = {
  rules: [
    {
      skill: "python-project-standards",
      triggers: { keywords: ["pyproject", "python"], files: ["pyproject.toml"] },
      priority: 1,
    },
    {
      skill: "fastapi-patterns",
      triggers: { keywords: ["fastapi", "router", "endpoint"], files: ["api/*.py"] },
      priority: 2,
    },
    {
      skill: "rag-vector-db",
      triggers: { keywords: ["qdrant", "embedding", "rag"], files: [] },
      priority: 3,
    },
  ],
  context_management: {
    max_skills_per_session: 3,
    compression_threshold_lines: 300,
    status_file: "dev/status.md",
    always_load_status: true,
  },
};

describe("loadSkillRules", () => {
  test("returns null when rules file does not exist", () => {
    const fs = mockFs({});
    expect(loadSkillRules(fs, "/nonexistent/path")).toBeNull();
  });

  test("returns null when rules file contains invalid JSON", () => {
    const fs = mockFs({ "/rules.json": "{ invalid json" });
    expect(loadSkillRules(fs, "/rules.json")).toBeNull();
  });

  test("returns parsed rules when file is valid JSON", () => {
    const content = JSON.stringify(MINIMAL_RULES);
    const fs = mockFs({ "/rules.json": content });
    const result = loadSkillRules(fs, "/rules.json");
    expect(result).not.toBeNull();
    expect(result.rules).toHaveLength(3);
  });
});

describe("loadStatusContent", () => {
  const mockPath = { join: (...parts) => parts.join("/") };

  test("returns null when status file does not exist", () => {
    const fs = mockFs({});
    expect(loadStatusContent(fs, mockPath, "/project", "dev/status.md")).toBeNull();
  });

  test("returns file content when status file exists", () => {
    const statusPath = "/project/dev/status.md";
    const content = "# Status\n\nGoal: build something";
    const fs = mockFs({ [statusPath]: content });
    expect(loadStatusContent(fs, mockPath, "/project", "dev/status.md")).toBe(content);
  });
});

describe("matchSkills", () => {
  const rules = MINIMAL_RULES.rules;

  test("returns empty array when prompt has no matching keywords", () => {
    expect(matchSkills(rules, "help me write a poem", [], 3)).toEqual([]);
  });

  test("matches skill by keyword in prompt", () => {
    const matched = matchSkills(rules, "how do I set up pyproject.toml", [], 3);
    expect(matched).toContain("python-project-standards");
  });

  test("matching is case-insensitive", () => {
    const matched = matchSkills(rules, "I need a FASTAPI router", [], 3);
    expect(matched).toContain("fastapi-patterns");
  });

  test("matches skill by changed file pattern", () => {
    const matched = matchSkills(rules, "update this", ["api/users.py"], 3);
    expect(matched).toContain("fastapi-patterns");
  });

  test("respects maxSkills limit", () => {
    const matched = matchSkills(rules, "pyproject fastapi qdrant embedding", [], 2);
    expect(matched).toHaveLength(2);
  });

  test("does not exceed maxSkills even with many matches", () => {
    const matched = matchSkills(rules, "pyproject fastapi qdrant", [], 1);
    expect(matched).toHaveLength(1);
    expect(matched[0]).toBe("python-project-standards");
  });

  test("returns empty array when rules list is empty", () => {
    expect(matchSkills([], "pyproject fastapi", [], 3)).toEqual([]);
  });

  test("matches always_load skill regardless of prompt", () => {
    const rulesWithAlways = [
      ...rules,
      { skill: "always-on", triggers: { always_load: true }, priority: 0 },
    ];
    const matched = matchSkills(rulesWithAlways, "unrelated prompt", [], 3);
    expect(matched).toContain("always-on");
  });
});

describe("matchSkills — optional rules", () => {
  const rulesWithOptional = [
    {
      skill: "python-project-standards",
      triggers: { keywords: ["pyproject", "python"], files: ["pyproject.toml"] },
      priority: 1,
    },
    {
      skill: "design-doc-creator",
      optional: true,
      triggers: { keywords: ["design document", "design doc"], files: ["design-doc.md"] },
      priority: 2,
    },
  ];

  test("skips optional skills even when keywords match", () => {
    const matched = matchSkills(rulesWithOptional, "write a design document for me", [], 3);
    expect(matched).not.toContain("design-doc-creator");
  });

  test("still matches non-optional skills when optional ones are present", () => {
    const matched = matchSkills(rulesWithOptional, "pyproject design document", [], 3);
    expect(matched).toContain("python-project-standards");
    expect(matched).not.toContain("design-doc-creator");
  });
});

describe("matchSkills — min_keyword_matches", () => {
  const rulesWithMin = [
    {
      skill: "langgraph-patterns",
      triggers: {
        keywords: ["langgraph", "state", "graph", "node"],
        min_keyword_matches: 2,
        files: ["graph.py"],
      },
      priority: 1,
    },
  ];

  test("does not activate with 1 keyword match when min_keyword_matches is 2", () => {
    const matched = matchSkills(rulesWithMin, "how does this graph work", [], 3);
    expect(matched).not.toContain("langgraph-patterns");
  });

  test("activates with 2 or more keyword matches", () => {
    const matched = matchSkills(rulesWithMin, "langgraph state machine setup", [], 3);
    expect(matched).toContain("langgraph-patterns");
  });

  test("activates on file match regardless of min_keyword_matches", () => {
    const matched = matchSkills(rulesWithMin, "update this", ["graph.py"], 3);
    expect(matched).toContain("langgraph-patterns");
  });
});


describe("loadSkillContent", () => {
  const mockPath = { join: (...parts) => parts.join("/") };

  test("returns null when skill file does not exist", () => {
    const fs = mockFs({});
    expect(loadSkillContent(fs, mockPath, "/project", "python-project-standards", 300)).toBeNull();
  });

  test("returns uncompressed content for short skill", () => {
    const skillPath = "/project/.claude/skills/python-project-standards/SKILL.md";
    const shortContent = Array(50).fill("line content").join("\n");
    const fs = mockFs({ [skillPath]: shortContent });

    const result = loadSkillContent(fs, mockPath, "/project", "python-project-standards", 300);
    expect(result).not.toBeNull();
    expect(result.compressed).toBe(false);
    expect(result.output).toContain("## Skill: python-project-standards");
    expect(result.output).not.toContain("compressed");
  });

  test("returns compressed content for skill exceeding threshold", () => {
    const skillPath = "/project/.claude/skills/fastapi-patterns/SKILL.md";
    const longContent = ["# FastAPI Patterns", "## When to Load", "## Core Setup"]
      .concat(Array(350).fill("some line content"))
      .join("\n");
    const fs = mockFs({ [skillPath]: longContent });

    const result = loadSkillContent(fs, mockPath, "/project", "fastapi-patterns", 300);
    expect(result).not.toBeNull();
    expect(result.compressed).toBe(true);
    expect(result.output).toContain("compressed");
    expect(result.output).toContain("353");
    expect(result.output).toContain("To load a specific section, ask explicitly.");
  });

  test("compressed output includes section headers", () => {
    const skillPath = "/project/.claude/skills/fastapi-patterns/SKILL.md";
    const longContent = ["# FastAPI Patterns", "## Section A", "## Section B"]
      .concat(Array(350).fill("filler"))
      .join("\n");
    const fs = mockFs({ [skillPath]: longContent });

    const result = loadSkillContent(fs, mockPath, "/project", "fastapi-patterns", 300);
    expect(result.output).toContain("Section A");
    expect(result.output).toContain("Section B");
  });
});

describe("buildOutput", () => {
  test("returns continue:true with no system_prompt_addition when injections empty", () => {
    const output = buildOutput([]);
    expect(output).toEqual({ continue: true });
    expect(output.additionalContext).toBeUndefined();
  });

  test("includes system_prompt_addition when injections present", () => {
    const output = buildOutput(["skill content A", "skill content B"]);
    expect(output.continue).toBe(true);
    expect(output.additionalContext).toContain("skill content A");
    expect(output.additionalContext).toContain("skill content B");
  });

  test("joins multiple injections with separator", () => {
    const output = buildOutput(["A", "B"]);
    expect(output.additionalContext).toContain("---");
  });
});

describe("buildInjections — integration", () => {
  const mockPath = { join: (...parts) => parts.join("/") };

  function buildMockFs(cwd, skills = {}) {
    const files = {};
    files[`${cwd}/dev/status.md`] = "# Status\n\nGoal: test project";
    for (const [skillName, content] of Object.entries(skills)) {
      files[`${cwd}/.claude/skills/${skillName}/SKILL.md`] = content;
    }
    return mockFs(files);
  }

  test("always injects status.md content first when it exists", () => {
    const fs = buildMockFs("/project");
    const { injections } = buildInjections(fs, mockPath, "/project", "unrelated prompt", [], MINIMAL_RULES);
    expect(injections[0]).toContain("Project Status");
    expect(injections[0]).toContain("Goal: test project");
  });

  test("injects matched skill content after status", () => {
    const fs = buildMockFs("/project", {
      "python-project-standards": "# Python Standards\n\nShort skill content.",
    });
    const { injections, matchedSkills } = buildInjections(
      fs, mockPath, "/project", "pyproject.toml setup", [], MINIMAL_RULES
    );
    expect(matchedSkills).toContain("python-project-standards");
    const skillInjection = injections.find((i) => i.includes("python-project-standards"));
    expect(skillInjection).toBeDefined();
  });

  test("returns empty injections when no status and no keyword match", () => {
    const fs = mockFs({});
    const { injections } = buildInjections(fs, mockPath, "/project", "write me a poem", [], MINIMAL_RULES);
    expect(injections).toHaveLength(0);
  });

  test("does not inject skill when its SKILL.md file is missing", () => {
    const fs = buildMockFs("/project");
    const { injections, matchedSkills } = buildInjections(
      fs, mockPath, "/project", "fastapi router endpoint", [], MINIMAL_RULES
    );
    expect(matchedSkills).toContain("fastapi-patterns");
    const skillInjection = injections.find((i) => i.includes("fastapi-patterns"));
    expect(skillInjection).toBeUndefined();
  });
});


describe("matchSkills — alreadyLoaded filter", () => {
  const rules = MINIMAL_RULES.rules;

  test("skips skills already in alreadyLoaded", () => {
    const matched = matchSkills(rules, "pyproject python", [], 3, ["python-project-standards"]);
    expect(matched).not.toContain("python-project-standards");
  });

  test("still matches other skills when some are already loaded", () => {
    const matched = matchSkills(rules, "fastapi router pyproject", [], 3, ["python-project-standards"]);
    expect(matched).toContain("fastapi-patterns");
    expect(matched).not.toContain("python-project-standards");
  });

  test("empty alreadyLoaded behaves as before", () => {
    const matched = matchSkills(rules, "pyproject python", [], 3, []);
    expect(matched).toContain("python-project-standards");
  });
});

describe("buildInjections — sessionContext", () => {
  const mockPath = { join: (...parts) => parts.join("/") };

  function buildMockFs(cwd, skills = {}) {
    const files = {};
    files[`${cwd}/dev/status.md`] = "# Status\n\nGoal: test project";
    for (const [skillName, content] of Object.entries(skills)) {
      files[`${cwd}/.claude/skills/${skillName}/SKILL.md`] = content;
    }
    return mockFs(files);
  }

  test("skips already loaded skills when alreadyLoadedSkills provided", () => {
    const fs = buildMockFs("/project", {
      "python-project-standards": "# Python Standards\n\nContent.",
    });
    const sessionContext = { alreadyLoadedSkills: ["python-project-standards"], lastStatusHash: null };
    const { matchedSkills } = buildInjections(
      fs, mockPath, "/project", "pyproject.toml setup", [], MINIMAL_RULES, sessionContext
    );
    expect(matchedSkills).not.toContain("python-project-standards");
  });

  test("skips status.md when hash unchanged", () => {
    const fs = buildMockFs("/project");
    const { statusHash } = buildInjections(
      fs, mockPath, "/project", "anything", [], MINIMAL_RULES, {}
    );
    const { injections } = buildInjections(
      fs, mockPath, "/project", "anything", [], MINIMAL_RULES,
      { alreadyLoadedSkills: [], lastStatusHash: statusHash }
    );
    const hasStatus = injections.some((i) => i.startsWith("## Project Status"));
    expect(hasStatus).toBe(false);
  });

  test("injects status.md when hash changed", () => {
    const fs = buildMockFs("/project");
    const { injections } = buildInjections(
      fs, mockPath, "/project", "anything", [], MINIMAL_RULES,
      { alreadyLoadedSkills: [], lastStatusHash: "stale-hash" }
    );
    const hasStatus = injections.some((i) => i.startsWith("## Project Status"));
    expect(hasStatus).toBe(true);
  });

  test("returns statusHash in result", () => {
    const fs = buildMockFs("/project");
    const { statusHash } = buildInjections(
      fs, mockPath, "/project", "anything", [], MINIMAL_RULES, {}
    );
    expect(typeof statusHash).toBe("string");
    expect(statusHash.length).toBeGreaterThan(0);
  });

  test("backward compatible — works without sessionContext argument", () => {
    const fs = buildMockFs("/project");
    expect(() => buildInjections(fs, mockPath, "/project", "anything", [], MINIMAL_RULES)).not.toThrow();
  });
});

describe("getSkillSize", () => {
  test("returns size_lines from skill-metadata.json", () => {
    const fs = mockFs({
      "skills/my-skill/skill-metadata.json": JSON.stringify({ size_lines: 120 }),
    });
    expect(getSkillSize("my-skill", "skills", fs)).toBe(120);
  });

  test("returns 300 when metadata file does not exist", () => {
    const fs = mockFs({});
    expect(getSkillSize("missing-skill", "skills", fs)).toBe(300);
  });

  test("returns 300 when size_lines is missing from metadata", () => {
    const fs = mockFs({
      "skills/my-skill/skill-metadata.json": JSON.stringify({ version: "1.0.0" }),
    });
    expect(getSkillSize("my-skill", "skills", fs)).toBe(300);
  });

  test("returns 300 when skillsDir is null", () => {
    expect(getSkillSize("my-skill", null, null)).toBe(300);
  });
});

describe("matchSkills — dynamic budget", () => {
  const budgetRules = [
    { skill: "always-on", triggers: { always_load: true }, priority: 0 },
    { skill: "small-skill", triggers: { keywords: ["small"] }, priority: 1 },
    { skill: "medium-skill", triggers: { keywords: ["medium"] }, priority: 2 },
    { skill: "large-skill", triggers: { keywords: ["large"] }, priority: 3 },
  ];

  function budgetFs(sizes) {
    const files = {};
    for (const [name, size] of Object.entries(sizes)) {
      files[`skills/${name}/skill-metadata.json`] = JSON.stringify({ size_lines: size });
    }
    return mockFs(files);
  }

  test("budget mode: small skills fit, large skills blocked", () => {
    const fs = budgetFs({
      "always-on": 160,
      "small-skill": 80,
      "medium-skill": 100,
      "large-skill": 700,
    });
    const result = matchSkills(
      budgetRules, "small medium large", [], 3, [],
      { budgetLines: 400, skillsDir: "skills", fsModule: fs }
    );
    expect(result.skills).toContain("always-on");
    expect(result.skills).toContain("small-skill");
    expect(result.skills).toContain("medium-skill");
    expect(result.skills).not.toContain("large-skill");
    expect(result.usedLines).toBe(340);
  });

  test("budget mode: always_load included even if over budget", () => {
    const fs = budgetFs({ "always-on": 500 });
    const result = matchSkills(
      budgetRules, "unrelated", [], 3, [],
      { budgetLines: 100, skillsDir: "skills", fsModule: fs }
    );
    expect(result.skills).toContain("always-on");
    expect(result.usedLines).toBe(500);
  });

  test("budget mode: returns object with skills and usedLines", () => {
    const fs = budgetFs({ "always-on": 160 });
    const result = matchSkills(
      budgetRules, "unrelated", [], 3, [],
      { budgetLines: 900, skillsDir: "skills", fsModule: fs }
    );
    expect(Array.isArray(result.skills)).toBe(true);
    expect(typeof result.usedLines).toBe("number");
  });

  test("fallback: returns array when no budgetLines", () => {
    const result = matchSkills(budgetRules, "small medium", [], 3);
    expect(Array.isArray(result)).toBe(true);
  });

  test("budget mode: more small skills fit than large", () => {
    const manySmallRules = [
      { skill: "s1", triggers: { keywords: ["s1"] }, priority: 1 },
      { skill: "s2", triggers: { keywords: ["s2"] }, priority: 2 },
      { skill: "s3", triggers: { keywords: ["s3"] }, priority: 3 },
      { skill: "s4", triggers: { keywords: ["s4"] }, priority: 4 },
    ];
    const fs = budgetFs({ s1: 50, s2: 50, s3: 50, s4: 50 });
    const result = matchSkills(
      manySmallRules, "s1 s2 s3 s4", [], 10, [],
      { budgetLines: 200, skillsDir: "skills", fsModule: fs }
    );
    expect(result.skills).toHaveLength(4);
    expect(result.usedLines).toBe(200);
  });

  test("budget mode: fallback size 300 when metadata missing", () => {
    const fs = mockFs({});
    const result = matchSkills(
      [{ skill: "no-meta", triggers: { keywords: ["test"] }, priority: 1 }],
      "test", [], 3, [],
      { budgetLines: 200, skillsDir: "skills", fsModule: fs }
    );
    expect(result.skills).toHaveLength(0);
    expect(result.usedLines).toBe(0);
  });
});

describe("matchSkills — platform_trigger", () => {
  const platformRules = [
    {
      skill: "windows-developer",
      triggers: {
        keywords: ["encoding", "utf-8"],
        platform_trigger: "win32",
      },
      priority: 22,
    },
    {
      skill: "linux-only",
      triggers: {
        keywords: ["encoding"],
        platform_trigger: "linux",
      },
      priority: 23,
    },
  ];

  test("platform_trigger matches on win32 via options.platform", () => {
    const matched = matchSkills(platformRules, "unrelated prompt", [], 3, [], { platform: "win32" });
    expect(matched).toContain("windows-developer");
    expect(matched).not.toContain("linux-only");
  });

  test("platform_trigger matches on linux via options.platform", () => {
    const matched = matchSkills(platformRules, "unrelated prompt", [], 3, [], { platform: "linux" });
    expect(matched).not.toContain("windows-developer");
    expect(matched).toContain("linux-only");
  });

  test("keyword match triggers regardless of platform", () => {
    const matched = matchSkills(platformRules, "fix encoding utf-8 issue", [], 3, [], { platform: "darwin" });
    expect(matched).toContain("windows-developer");
  });

  test("platform defaults to process.platform when not in options", () => {
    const matched = matchSkills(platformRules, "unrelated prompt", [], 3);
    if (process.platform === "win32") {
      expect(matched).toContain("windows-developer");
    } else {
      expect(matched).not.toContain("windows-developer");
    }
  });
});

describe("extractRelevantPitfalls", () => {
  const PITFALLS = `# Known Pitfalls

## Docker
- Use docker compose v2
- Never bind-mount node_modules

## Authentication
- Always validate JWT expiry server-side
- Rate-limit login endpoints

## Terraform
- Use prevent_destroy on production
`;

  test("returns matching section when changed file matches header", () => {
    const result = extractRelevantPitfalls(PITFALLS, ["Dockerfile", "docker-compose.yml"], "build the app");
    expect(result).toContain("docker compose v2");
    expect(result).not.toContain("JWT");
    expect(result).not.toContain("Terraform");
  });

  test("returns matching section when prompt matches header", () => {
    const result = extractRelevantPitfalls(PITFALLS, [], "fix the authentication flow");
    expect(result).toContain("JWT");
    expect(result).not.toContain("docker");
  });

  test("returns multiple matching sections", () => {
    const result = extractRelevantPitfalls(PITFALLS, ["Dockerfile"], "fix authentication");
    expect(result).toContain("docker compose");
    expect(result).toContain("JWT");
  });

  test("returns null when nothing matches", () => {
    const result = extractRelevantPitfalls(PITFALLS, ["readme.md"], "update docs");
    expect(result).toBeNull();
  });

  test("returns null for empty content", () => {
    expect(extractRelevantPitfalls("", [], "anything")).toBeNull();
    expect(extractRelevantPitfalls(null, [], "anything")).toBeNull();
  });
});
