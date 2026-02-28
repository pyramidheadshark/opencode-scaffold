const path = require("path");
const { spawnSync } = require("child_process");

const HOOK_PATH = path.resolve(__dirname, "../../.claude/hooks/skill-activation-prompt.js");
const FIXTURE_CWD = path.resolve(__dirname, "../fixtures/project-with-status");

function runHook(prompt, cwd = FIXTURE_CWD) {
  const result = spawnSync("node", [HOOK_PATH], {
    input: JSON.stringify({ prompt }),
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
