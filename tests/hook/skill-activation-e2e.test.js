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
