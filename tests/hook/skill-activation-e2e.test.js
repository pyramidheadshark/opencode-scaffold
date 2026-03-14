const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");

const HOOK_PATH = path.resolve(__dirname, "../../.claude/hooks/skill-activation-prompt.js");
const FIXTURE_CWD = path.resolve(__dirname, "../fixtures/project-with-status");

function runHook(prompt, cwd = FIXTURE_CWD, sessionId = null) {
  const input = { prompt };
  if (sessionId) input.session_id = sessionId;
  const result = spawnSync("node", [HOOK_PATH], {
    input: JSON.stringify(input),
    cwd,
    encoding: "utf-8",
    timeout: 5000,
  });
  if (result.error) throw result.error;
  return JSON.parse(result.stdout);
}

function getLoadedSkills(output) {
  const addition = output.system_prompt_addition || "";
  return addition
    .split("\n")
    .filter((l) => l.startsWith("## Skill:"))
    .map((l) => l.replace("## Skill:", "").trim().split(" ")[0]);
}

describe("E2E — hook process output", () => {
  beforeEach(() => {
    const cacheDir = path.join(FIXTURE_CWD, ".claude/cache");
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  test("returns valid JSON with continue:true for any prompt", () => {
    const output = runHook("just a random prompt");
    expect(output.continue).toBe(true);
  });

  test("always injects python-project-standards (always_load:true)", () => {
    const output = runHook("write me a poem about clouds");
    expect(output.system_prompt_addition).toBeDefined();
    expect(getLoadedSkills(output)).toContain("python-project-standards");
  });

  test("injects fastapi-patterns when keyword matches", () => {
    const output = runHook("help me write a fastapi router");
    expect(getLoadedSkills(output)).toContain("fastapi-patterns");
  });

  test("does not inject optional design-doc-creator automatically", () => {
    const output = runHook("I need to write a design document for my project");
    expect(getLoadedSkills(output)).not.toContain("design-doc-creator");
  });

  test("does not activate langgraph-patterns with only 1 generic keyword", () => {
    const output = runHook("how does this graph work");
    expect(getLoadedSkills(output)).not.toContain("langgraph-patterns");
  });

  test("activates langgraph-patterns with 2+ keyword matches", () => {
    const output = runHook("langgraph state machine setup guide");
    expect(getLoadedSkills(output)).toContain("langgraph-patterns");
  });

  test("injects plan mode reminder on RU planning keyword", () => {
    const output = runHook("давай запланируем новую фичу");
    expect(output.system_prompt_addition).toContain("MANDATORY");
    expect(output.system_prompt_addition).toContain("EnterPlanMode");
  });

  test("injects plan mode reminder on EN planning keyword", () => {
    const output = runHook("let's plan a multi-step refactor");
    expect(output.system_prompt_addition).toContain("MANDATORY");
  });

  test("injects plan mode reminder for EN scope keyword: refactor", () => {
    const output = runHook("let's refactor the auth module");
    expect(output.system_prompt_addition).toContain("MANDATORY");
    expect(output.system_prompt_addition).toContain("EnterPlanMode");
  });

  test("injects plan mode reminder for RU scope keyword: рефакторинг", () => {
    const output = runHook("давай спланируем архитектуру");
    expect(output.system_prompt_addition).toContain("MANDATORY");
  });

  test("does not inject plan mode reminder for simple questions", () => {
    const output = runHook("what does this function do?");
    expect(output.system_prompt_addition || "").not.toContain("MANDATORY");
    expect(output.system_prompt_addition || "").not.toContain("EnterPlanMode");
  });

  test("does not inject plan mode reminder for generic prompts", () => {
    const output = runHook("fix the login bug");
    expect(output.system_prompt_addition || "").not.toContain("MANDATORY");
  });

  test("plan-mode block includes clarifying survey questions", () => {
    const output = runHook("давай спланируем рефакторинг");
    const addition = output.system_prompt_addition || "";
    expect(addition).toContain("MANDATORY");
    expect(addition).toContain("Scope");
    expect(addition).toContain("Success criteria");
  });

  test("injects plan mode for new RU keywords: внедри, оптимизир, разверни", () => {
    const cases = [
      "внедри авторизацию в FastAPI",
      "оптимизируй пайплайн обработки данных",
      "разверни приложение на сервере",
    ];
    for (const prompt of cases) {
      const output = runHook(prompt);
      expect(output.system_prompt_addition || "").toContain("MANDATORY");
    }
  });

  test("does not inject plan mode for RU question prefixes: можешь, можно", () => {
    const cases = [
      "можешь объяснить архитектуру рефакторинга?",
      "можно ли так написать внедри паттерн?",
    ];
    for (const prompt of cases) {
      const output = runHook(prompt);
      expect(output.system_prompt_addition || "").not.toContain("MANDATORY");
    }
  });
});

describe("E2E — security hint injection", () => {
  const { execSync } = require("child_process");
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-sec-test-"));
    execSync("git init", { cwd: tmpDir });
    execSync("git config user.email test@test.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "auth_service.py"), "# auth", "utf8");
    execSync("git add .", { cwd: tmpDir });
    const skillsDir = path.join(tmpDir, ".claude/skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.copyFileSync(
      path.join(FIXTURE_CWD, ".claude/skills/skill-rules.json"),
      path.join(skillsDir, "skill-rules.json")
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("injects security hint when auth file is in git status", () => {
    const output = runHook("fix the bug", tmpDir);
    expect(output.system_prompt_addition || "").toContain("Security Heads-Up");
  });

  test("does NOT inject security hint when no security-sensitive files changed", () => {
    const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-sec-clean-"));
    try {
      execSync("git init", { cwd: cleanDir });
      execSync("git config user.email test@test.com", { cwd: cleanDir });
      execSync("git config user.name Test", { cwd: cleanDir });
      fs.writeFileSync(path.join(cleanDir, "utils.py"), "# utils", "utf8");
      execSync("git add .", { cwd: cleanDir });
      const skillsDir = path.join(cleanDir, ".claude/skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.copyFileSync(
        path.join(FIXTURE_CWD, ".claude/skills/skill-rules.json"),
        path.join(skillsDir, "skill-rules.json")
      );
      const output = runHook("fix the bug", cleanDir);
      expect(output.system_prompt_addition || "").not.toContain("Security Heads-Up");
    } finally {
      fs.rmSync(cleanDir, { recursive: true, force: true });
    }
  });
});

describe("E2E — session cache deduplication", () => {
  let tmpCwd;

  beforeEach(() => {
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-cache-test-"));
    const claudeDir = path.join(tmpCwd, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    const devDir = path.join(tmpCwd, "dev");
    fs.mkdirSync(devDir, { recursive: true });
    fs.writeFileSync(path.join(devDir, "status.md"), "# Status\n\nGoal: test", "utf8");
    const fixtureRules = path.join(FIXTURE_CWD, ".claude/skills/skill-rules.json");
    const fixtureSkillsDir = path.join(FIXTURE_CWD, ".claude/skills");
    const destSkillsDir = path.join(tmpCwd, ".claude/skills");
    fs.mkdirSync(destSkillsDir, { recursive: true });
    fs.copyFileSync(fixtureRules, path.join(destSkillsDir, "skill-rules.json"));
    for (const entry of fs.readdirSync(fixtureSkillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const src = path.join(fixtureSkillsDir, entry.name);
        const dst = path.join(destSkillsDir, entry.name);
        fs.mkdirSync(dst, { recursive: true });
        for (const f of fs.readdirSync(src)) {
          fs.copyFileSync(path.join(src, f), path.join(dst, f));
        }
      }
    }
  });

  afterEach(() => {
    fs.rmSync(tmpCwd, { recursive: true, force: true });
  });

  test("second prompt with same session skips already loaded skills", () => {
    const sessionId = "test-session-dedup";

    const output1 = runHook("write me a fastapi router", tmpCwd, sessionId);
    const skills1 = getLoadedSkills(output1);
    expect(skills1).toContain("python-project-standards");

    const output2 = runHook("write me a fastapi router", tmpCwd, sessionId);
    const skills2 = getLoadedSkills(output2);
    expect(skills2).not.toContain("python-project-standards");
  });
});
