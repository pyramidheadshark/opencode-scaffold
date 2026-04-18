const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { main } = require("../../.claude/hooks/session-checkpoint");

const HOOK_PATH = path.resolve(__dirname, "../../.claude/hooks/session-checkpoint.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-checkpoint-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function readCache(tmpDir, sessionId) {
  const cachePath = path.join(tmpDir, `.claude/cache/checkpoint-${sessionId}.json`);
  if (!fs.existsSync(cachePath)) return null;
  return JSON.parse(fs.readFileSync(cachePath, "utf8"));
}

function writeCache(tmpDir, sessionId, data) {
  const cacheDir = path.join(tmpDir, ".claude/cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, `checkpoint-${sessionId}.json`),
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

describe("ExitPlanMode trigger", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("returns hookSpecificOutput.additionalContext on ExitPlanMode", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeDefined();
    expect(result.hookSpecificOutput.additionalContext).toContain("[AUTO CHECKPOINT — Plan Approved]");
  });

  test("additionalContext contains required status sections", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text).toContain("dev/status.md");
    expect(text).toContain("Active phase marker");
    expect(text).toContain("Key architectural decisions");
  });

  test("ExitPlanMode compact message does NOT contain old COMPACT REQUIRED text", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text).not.toContain("COMPACT REQUIRED BEFORE STEP 1");
    expect(text).not.toContain("Step 1 — Generate a Post-Compact Resume Message");
  });

  test("ExitPlanMode compact message mentions Clear context button", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text).toContain("Clear context");
  });

  test("before-implementation section appears AFTER status write instruction (ordering)", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text.indexOf("BEFORE STARTING IMPLEMENTATION")).toBeGreaterThan(text.indexOf("dev/status.md"));
  });

  test("updates last_checkpoint_count in cache on ExitPlanMode", () => {
    main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const cache = readCache(tmpDir, "s1");
    expect(cache.tool_call_count).toBe(1);
    expect(cache.last_checkpoint_count).toBe(1);
  });
});

describe("context_critical trigger", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("context_critical: true in cache → compact signal in additionalContext", () => {
    writeCache(tmpDir, "ctx1", { context_critical: true, context_remaining_pct: 15 });
    const result = main(JSON.stringify({ tool_name: "Read", session_id: "ctx1" }), tmpDir);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeDefined();
    expect(result.hookSpecificOutput.additionalContext).toContain("Context Critical");
  });

  test("context_critical: false + non-ExitPlanMode → no signal", () => {
    writeCache(tmpDir, "ctx2", { context_critical: false, context_remaining_pct: 55 });
    const result = main(JSON.stringify({ tool_name: "Read", session_id: "ctx2" }), tmpDir);
    expect(result).toEqual({ continue: true });
  });

  test("threshold block contains percentage and Clear context", () => {
    writeCache(tmpDir, "ctx3", { context_critical: true, context_remaining_pct: 12 });
    const result = main(JSON.stringify({ tool_name: "Bash", session_id: "ctx3" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text).toContain("%");
    expect(text).toContain("Clear context");
  });

  test("context_critical: true shows pct from cache in message", () => {
    writeCache(tmpDir, "ctx4", { context_critical: true, context_remaining_pct: 8 });
    const result = main(JSON.stringify({ tool_name: "Edit", session_id: "ctx4" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text).toContain("8%");
  });
});

describe("Non-trigger tools", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test.each(["Read", "Edit", "Bash", "Write", "Glob", "Grep", "Agent"])(
    "%s returns only { continue: true } with empty cache",
    (tool) => {
      const result = main(JSON.stringify({ tool_name: tool, session_id: "s6" }), tmpDir);
      expect(result).toEqual({ continue: true });
    }
  );

  test("increments tool_call_count without triggering", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "s7" }), tmpDir);
    main(JSON.stringify({ tool_name: "Edit", session_id: "s7" }), tmpDir);
    const cache = readCache(tmpDir, "s7");
    expect(cache.tool_call_count).toBe(2);
    expect(cache.last_checkpoint_count).toBe(0);
  });
});

describe("Edge cases", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("empty input returns { continue: true }", () => {
    const result = main("", tmpDir);
    expect(result).toEqual({ continue: true });
  });

  test("malformed JSON returns { continue: true }", () => {
    const result = main("{not valid json}", tmpDir);
    expect(result).toEqual({ continue: true });
  });

  test("missing session_id uses 'default'", () => {
    main(JSON.stringify({ tool_name: "Read" }), tmpDir);
    const cache = readCache(tmpDir, "default");
    expect(cache).not.toBeNull();
    expect(cache.tool_call_count).toBe(1);
  });

  test("cache persists across multiple calls", () => {
    main(JSON.stringify({ tool_name: "Read", session_id: "s8" }), tmpDir);
    main(JSON.stringify({ tool_name: "Edit", session_id: "s8" }), tmpDir);
    main(JSON.stringify({ tool_name: "Bash", session_id: "s8" }), tmpDir);
    const cache = readCache(tmpDir, "s8");
    expect(cache.tool_call_count).toBe(3);
  });
});

describe("E2E — spawned process", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("ExitPlanMode → injection in stdout", () => {
    const input = JSON.stringify({ tool_name: "ExitPlanMode", session_id: "e2e-1" });
    const result = spawnSync("node", [HOOK_PATH], {
      input,
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput.additionalContext).toContain("AUTO CHECKPOINT");
  });

  test("Read tool → { continue: true } only", () => {
    const input = JSON.stringify({ tool_name: "Read", session_id: "e2e-2" });
    const result = spawnSync("node", [HOOK_PATH], {
      input,
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });

  test("handles empty input gracefully", () => {
    const result = spawnSync("node", [HOOK_PATH], {
      input: "{}",
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });

  test("context_critical in cache → compact signal via spawned process", () => {
    const cacheDir = path.join(tmpDir, ".claude/cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, "checkpoint-e2e-ctx.json"),
      JSON.stringify({ context_critical: true, context_remaining_pct: 14 }),
      "utf8"
    );
    const result = spawnSync("node", [HOOK_PATH], {
      input: JSON.stringify({ tool_name: "Read", session_id: "e2e-ctx" }),
      encoding: "utf8",
      cwd: tmpDir,
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain("Context Critical");
    expect(output.hookSpecificOutput.additionalContext).toContain("14%");
  });
});
