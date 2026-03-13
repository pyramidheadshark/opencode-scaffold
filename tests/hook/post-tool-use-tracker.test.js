const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { main } = require("../../.claude/hooks/post-tool-use-tracker");

const HOOK_PATH = path.resolve(__dirname, "../../.claude/hooks/post-tool-use-tracker.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "post-tool-tracker-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function readLog(tmpDir) {
  const logPath = path.join(tmpDir, ".claude/logs/tool-usage.jsonl");
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

describe("main — return value", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("always returns { continue: true }", () => {
    const result = main("{}", tmpDir);
    expect(result).toEqual({ continue: true });
  });

  test("returns { continue: true } on empty input", () => {
    const result = main("", tmpDir);
    expect(result).toEqual({ continue: true });
  });

  test("returns { continue: true } on malformed JSON", () => {
    const result = main("{not valid json}", tmpDir);
    expect(result).toEqual({ continue: true });
  });
});

describe("main — log extraction", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("extracts tool_name correctly", () => {
    main(JSON.stringify({ tool_name: "Edit", session_id: "s1", tool_response: {} }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].tool).toBe("Edit");
  });

  test("extracts session_id correctly", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "abc-123", tool_response: {} }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].session_id).toBe("abc-123");
  });

  test("is_error is true when tool_response.is_error is true", () => {
    main(JSON.stringify({ tool_name: "Bash", session_id: "s2", tool_response: { is_error: true } }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].is_error).toBe(true);
  });

  test("is_error is false when tool_response.is_error is false", () => {
    main(JSON.stringify({ tool_name: "Write", session_id: "s3", tool_response: { is_error: false } }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].is_error).toBe(false);
  });

  test("is_error defaults to false when tool_response missing", () => {
    main(JSON.stringify({ tool_name: "Glob", session_id: "s4" }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].is_error).toBe(false);
  });

  test("defaults tool_name to 'unknown' when missing", () => {
    main(JSON.stringify({ session_id: "s5" }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].tool).toBe("unknown");
  });

  test("defaults session_id to 'unknown' when missing", () => {
    main(JSON.stringify({ tool_name: "Read" }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].session_id).toBe("unknown");
  });

  test("repo field equals basename of cwd", () => {
    main("{}", tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].repo).toBe(path.basename(tmpDir));
  });

  test("timestamp is ISO 8601 format", () => {
    main("{}", tmpDir);
    const entries = readLog(tmpDir);
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("main — log file", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("creates .claude/logs/tool-usage.jsonl", () => {
    main("{}", tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".claude/logs/tool-usage.jsonl"))).toBe(true);
  });

  test("appends multiple entries", () => {
    main(JSON.stringify({ tool_name: "Edit" }), tmpDir);
    main(JSON.stringify({ tool_name: "Read" }), tmpDir);
    main(JSON.stringify({ tool_name: "Bash" }), tmpDir);
    const entries = readLog(tmpDir);
    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.tool)).toEqual(["Edit", "Read", "Bash"]);
  });
});

describe("E2E — spawned process", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("stdout is { continue: true }", () => {
    const input = JSON.stringify({ tool_name: "Edit", session_id: "e2e-1", tool_response: {} });
    const result = spawnSync("node", [HOOK_PATH], {
      input,
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toEqual({ continue: true });
  });

  test("log file created after spawn", () => {
    const input = JSON.stringify({ tool_name: "Write", session_id: "e2e-2" });
    spawnSync("node", [HOOK_PATH], { input, encoding: "utf8", cwd: tmpDir });
    expect(fs.existsSync(path.join(tmpDir, ".claude/logs/tool-usage.jsonl"))).toBe(true);
    const entries = readLog(tmpDir);
    expect(entries[0].tool).toBe("Write");
  });

  test("handles empty stdin gracefully", () => {
    const result = spawnSync("node", [HOOK_PATH], {
      input: "{}",
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });
});
