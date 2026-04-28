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

function readSessionCache(dir, sessionId) {
  const p = path.join(dir, ".claude", "cache", `session-${sessionId}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readSessionJsonl(dir) {
  const sessDir = path.join(dir, ".claude", "logs", "sessions");
  if (!fs.existsSync(sessDir)) return [];
  const files = fs.readdirSync(sessDir).filter(f => f.endsWith(".jsonl"));
  if (files.length === 0) return [];
  return fs.readFileSync(path.join(sessDir, files[0]), "utf8")
    .trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
}

describe("weight accumulation", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("Write adds weight 2", () => {
    main(JSON.stringify({ tool_name: "Write", session_id: "w1" }), tmpDir);
    const cache = readSessionCache(tmpDir, "w1");
    expect(cache.weight).toBeCloseTo(2);
  });

  test("Edit adds weight 1", () => {
    main(JSON.stringify({ tool_name: "Edit", session_id: "w2" }), tmpDir);
    const cache = readSessionCache(tmpDir, "w2");
    expect(cache.weight).toBeCloseTo(1);
  });

  test("Bash adds weight 0.3", () => {
    main(JSON.stringify({ tool_name: "Bash", session_id: "w3" }), tmpDir);
    const cache = readSessionCache(tmpDir, "w3");
    expect(cache.weight).toBeCloseTo(0.3);
  });

  test("Read adds weight 0", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "w4" }), tmpDir);
    const cache = readSessionCache(tmpDir, "w4");
    expect(cache.weight || 0).toBeCloseTo(0);
  });

  test("weight accumulates across multiple calls", () => {
    main(JSON.stringify({ tool_name: "Write", session_id: "w5" }), tmpDir);
    main(JSON.stringify({ tool_name: "Write", session_id: "w5" }), tmpDir);
    main(JSON.stringify({ tool_name: "Edit", session_id: "w5" }), tmpDir);
    const cache = readSessionCache(tmpDir, "w5");
    expect(cache.weight).toBeCloseTo(5);
  });
});

describe("session JSONL — session_start", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("first call writes session_start event", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "init1" }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("session_start");
  });

  test("session_start event has session_id field", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "init2" }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    expect(events[0].session_id).toBe("init2");
  });

  test("session_start not duplicated on second call", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "init3" }), tmpDir);
    main(JSON.stringify({ tool_name: "Read", session_id: "init3" }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    expect(events.filter(e => e.type === "session_start")).toHaveLength(1);
  });
});

describe("session JSONL — file_change", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("Write tool writes file_change event", () => {
    main(JSON.stringify({ tool_name: "Write", session_id: "fc1", tool_input: { file_path: "src/foo.py" } }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    const fc = events.find(e => e.type === "file_change");
    expect(fc).toBeDefined();
    expect(fc.tool).toBe("Write");
  });

  test("Edit tool writes file_change event", () => {
    main(JSON.stringify({ tool_name: "Edit", session_id: "fc2", tool_input: { file_path: "src/bar.py" } }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    const fc = events.find(e => e.type === "file_change");
    expect(fc).toBeDefined();
    expect(fc.tool).toBe("Edit");
  });

  test("file_change event contains path from tool_input", () => {
    main(JSON.stringify({ tool_name: "Write", session_id: "fc3", tool_input: { file_path: "src/auth.py" } }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    const fc = events.find(e => e.type === "file_change");
    expect(fc.path).toBe("src/auth.py");
  });

  test("Bash does NOT write file_change event", () => {
    main(JSON.stringify({ tool_name: "Bash", session_id: "fc4", tool_input: { command: "ls" } }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    expect(events.filter(e => e.type === "file_change")).toHaveLength(0);
  });

  test("Read does NOT write file_change event", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "fc5" }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    expect(events.filter(e => e.type === "file_change")).toHaveLength(0);
  });
});

describe("bash_command tracking", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("Bash tool call appends bash_command event to session JSONL", () => {
    main(JSON.stringify({ tool_name: "Bash", session_id: "bc1", tool_input: { command: "npm test" } }), tmpDir);
    const events = readSessionJsonl(tmpDir);
    const bashEvent = events.find(e => e.type === "bash_command");
    expect(bashEvent).toBeDefined();
    expect(bashEvent.command).toBe("npm test");
    expect(bashEvent.tool).toBe("Bash");
  });

  test("increments tool_call_count in session cache for every tool", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "tc1" }), tmpDir);
    main(JSON.stringify({ tool_name: "Edit", session_id: "tc1" }), tmpDir);
    main(JSON.stringify({ tool_name: "Bash", session_id: "tc1", tool_input: { command: "ls" } }), tmpDir);
    const cache = readSessionCache(tmpDir, "tc1");
    expect(cache.tool_call_count).toBe(3);
  });
});
