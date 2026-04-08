const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { main } = require("../../.claude/hooks/bash-output-filter");

const HOOK_PATH = path.resolve(__dirname, "../../.claude/hooks/bash-output-filter.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bash-output-filter-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makeInput(command, toolName = "Bash") {
  return JSON.stringify({ tool_name: toolName, tool_input: { command } });
}

function readLog(tmpDir) {
  const logPath = path.join(tmpDir, ".claude", "logs", "filter-log.jsonl");
  if (!fs.existsSync(logPath)) return null;
  return fs.readFileSync(logPath, "utf8").trim().split("\n").map(l => JSON.parse(l));
}

describe("Whitelist matching", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("pytest → appends grep filter with PASSED/FAILED and tail -80", () => {
    const result = main(makeInput("pytest tests/"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("grep -E");
    expect(result.updatedInput.command).toContain("PASSED");
    expect(result.updatedInput.command).toContain("FAILED");
    expect(result.updatedInput.command).toContain("tail -80");
  });

  test("git log → appends head -30", () => {
    const result = main(makeInput("git log --oneline -20"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("head -30");
  });

  test("git diff --stat → appends tail -25", () => {
    const result = main(makeInput("git diff --stat HEAD~1"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("tail -25");
  });

  test("npm test → appends grep filter", () => {
    const result = main(makeInput("npm test"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("grep -E");
    expect(result.updatedInput.command).toContain("tail -50");
  });

  test("pip install → appends grep filter with Requirement already", () => {
    const result = main(makeInput("pip install requests"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("grep -E");
    expect(result.updatedInput.command).toContain("Requirement already");
  });

  test("npm install → appends grep filter with tail -20", () => {
    const result = main(makeInput("npm install axios"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("grep -E");
    expect(result.updatedInput.command).toContain("tail -20");
  });

  test("docker build → appends tail -30", () => {
    const result = main(makeInput("docker build -t myapp ."), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("tail -30");
  });

  test("uv sync → appends tail -40", () => {
    const result = main(makeInput("uv sync"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("tail -40");
  });

  test("mypy → appends grep filter with tail -30", () => {
    const result = main(makeInput("mypy src/"), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("grep -E");
    expect(result.updatedInput.command).toContain("tail -30");
  });

  test("ruff check → appends tail -25", () => {
    const result = main(makeInput("ruff check ."), tmpDir);
    expect(result.updatedInput).toBeDefined();
    expect(result.updatedInput.command).toContain("tail -25");
  });
});

describe("Non-matching commands", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("ls returns { action: 'continue' } without updatedInput", () => {
    const result = main(makeInput("ls -la"), tmpDir);
    expect(result).toEqual({ action: "continue" });
    expect(result.updatedInput).toBeUndefined();
  });

  test("cat file.py returns { action: 'continue' } without updatedInput", () => {
    const result = main(makeInput("cat src/main.py"), tmpDir);
    expect(result).toEqual({ action: "continue" });
  });

  test("git status returns { action: 'continue' } without updatedInput", () => {
    const result = main(makeInput("git status"), tmpDir);
    expect(result).toEqual({ action: "continue" });
  });
});

describe("Prefix matching accuracy", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("pytest tests/ matches (starts with pytest)", () => {
    const result = main(makeInput("pytest tests/"), tmpDir);
    expect(result.updatedInput).toBeDefined();
  });

  test("pytest --verbose matches", () => {
    const result = main(makeInput("pytest --verbose -s"), tmpDir);
    expect(result.updatedInput).toBeDefined();
  });

  test("echo pytest does NOT match", () => {
    const result = main(makeInput("echo pytest"), tmpDir);
    expect(result.updatedInput).toBeUndefined();
  });

  test("ls pytest-results/ does NOT match", () => {
    const result = main(makeInput("ls pytest-results/"), tmpDir);
    expect(result.updatedInput).toBeUndefined();
  });

  test("leading whitespace in command is ignored for matching", () => {
    const result = main(makeInput("  pytest tests/"), tmpDir);
    expect(result.updatedInput).toBeDefined();
  });
});

describe("Command wrapping format", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("wrapped command uses { original; } syntax", () => {
    const result = main(makeInput("pytest tests/unit/"), tmpDir);
    const cmd = result.updatedInput.command;
    expect(cmd).toMatch(/^\{ pytest tests\/unit\/; \}/);
  });

  test("wrapped command preserves original command exactly inside braces", () => {
    const result = main(makeInput("git log --oneline --graph"), tmpDir);
    const cmd = result.updatedInput.command;
    expect(cmd).toContain("{ git log --oneline --graph; }");
  });

  test("wrapped command includes || true fallback", () => {
    const result = main(makeInput("pytest tests/"), tmpDir);
    expect(result.updatedInput.command).toContain("|| true");
  });
});

describe("Log writing", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("creates .claude/logs/filter-log.jsonl on match", () => {
    main(makeInput("pytest tests/"), tmpDir);
    const logPath = path.join(tmpDir, ".claude", "logs", "filter-log.jsonl");
    expect(fs.existsSync(logPath)).toBe(true);
  });

  test("log entry has ts, cmd_match, original_bytes, filtered_cmd_bytes", () => {
    main(makeInput("pytest tests/unit/"), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.ts).toBeDefined();
    expect(e.cmd_match).toBe("pytest");
    expect(typeof e.original_bytes).toBe("number");
    expect(typeof e.filtered_cmd_bytes).toBe("number");
    expect(e.filtered_cmd_bytes).toBeGreaterThan(e.original_bytes);
  });

  test("no log written for non-matching command", () => {
    main(makeInput("ls -la"), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries).toBeNull();
  });

  test("multiple matches append to the same log file", () => {
    main(makeInput("pytest tests/a"), tmpDir);
    main(makeInput("git log --oneline"), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries).toHaveLength(2);
  });
});

describe("Non-Bash tools", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test.each(["Read", "Edit", "Write", "Glob", "Grep"])(
    "%s tool returns { action: 'continue' } without updatedInput",
    (toolName) => {
      const result = main(makeInput("pytest tests/", toolName), tmpDir);
      expect(result).toEqual({ action: "continue" });
      expect(result.updatedInput).toBeUndefined();
    }
  );
});

describe("Edge cases", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("empty input string returns { action: 'continue' }", () => {
    const result = main("", tmpDir);
    expect(result).toEqual({ action: "continue" });
  });

  test("malformed JSON returns { action: 'continue' }", () => {
    const result = main("{not valid json}", tmpDir);
    expect(result).toEqual({ action: "continue" });
  });

  test("empty command returns { action: 'continue' }", () => {
    const result = main(makeInput(""), tmpDir);
    expect(result).toEqual({ action: "continue" });
  });

  test("missing tool_input returns { action: 'continue' }", () => {
    const result = main(JSON.stringify({ tool_name: "Bash" }), tmpDir);
    expect(result).toEqual({ action: "continue" });
  });

  test("action: 'continue' is always present in returned object", () => {
    const r1 = main(makeInput("pytest tests/"), tmpDir);
    const r2 = main(makeInput("ls"), tmpDir);
    expect(r1.action).toBe("continue");
    expect(r2.action).toBe("continue");
  });
});

describe("E2E — spawned process", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("pytest → updatedInput contains grep", () => {
    const input = makeInput("pytest tests/unit/");
    const result = spawnSync("node", [HOOK_PATH], {
      input,
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.action).toBe("continue");
    expect(output.updatedInput).toBeDefined();
    expect(output.updatedInput.command).toContain("grep");
  });

  test("ls → no updatedInput", () => {
    const input = makeInput("ls -la");
    const result = spawnSync("node", [HOOK_PATH], {
      input,
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toEqual({ action: "continue" });
  });

  test("empty input → { action: 'continue' }", () => {
    const result = spawnSync("node", [HOOK_PATH], {
      input: "{}",
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ action: "continue" });
  });
});
