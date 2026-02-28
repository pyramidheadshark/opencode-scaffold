const path = require("path");
const { loadSkillRules, loadStatusContent, matchSkills, loadSkillContent, buildInjections, buildOutput } = require("../../.claude/hooks/skill-activation-logic");

const FIXTURE_WITH_STATUS = path.join(__dirname, "../fixtures/project-with-status");

function mockFs(files = {}) {
  return {
    existsSync: (p) => p in files,
    readFileSync: (p, enc) => {
      if (!(p in files)) throw new Error(`File not found: ${p}`);
      return files[p];
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

describe("matchSkills — always_load with optional filter", () => {
  const mixedRules = [
    {
      skill: "python-project-standards",
      triggers: { always_load: true, keywords: [], files: [] },
      priority: 1,
    },
    {
      skill: "skill-developer",
      optional: true,
      triggers: { keywords: ["create skill", "new skill"], files: [] },
      priority: 2,
    },
  ];

  test("always_load non-optional skill is always included", () => {
    const matched = matchSkills(mixedRules, "write me a poem about clouds", [], 3);
    expect(matched).toContain("python-project-standards");
  });

  test("optional skill is never included even with matching keyword", () => {
    const matched = matchSkills(mixedRules, "create skill for my project", [], 3);
    expect(matched).toContain("python-project-standards");
    expect(matched).not.toContain("skill-developer");
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
    expect(output.system_prompt_addition).toBeUndefined();
  });

  test("includes system_prompt_addition when injections present", () => {
    const output = buildOutput(["skill content A", "skill content B"]);
    expect(output.continue).toBe(true);
    expect(output.system_prompt_addition).toContain("skill content A");
    expect(output.system_prompt_addition).toContain("skill content B");
  });

  test("joins multiple injections with separator", () => {
    const output = buildOutput(["A", "B"]);
    expect(output.system_prompt_addition).toContain("---");
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
