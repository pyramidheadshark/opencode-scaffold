const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { main } = require("../../.claude/hooks/session-status-monitor");

const HOOK_PATH = path.resolve(__dirname, "../../.claude/hooks/session-status-monitor.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "status-monitor-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function readCache(tmpDir, sessionId) {
  const cachePath = path.join(tmpDir, `.claude/cache/checkpoint-${sessionId}.json`);
  if (!fs.existsSync(cachePath)) return null;
  return JSON.parse(fs.readFileSync(cachePath, "utf8"));
}

function runHook(tmpDir, input, env) {
  return spawnSync("node", [HOOK_PATH], {
    input: JSON.stringify(input),
    encoding: "utf8",
    cwd: tmpDir,
    env: { ...process.env, ...(env || {}) },
  });
}

describe("context_critical flag — E2E", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("remaining=18 → context_critical: true in cache", () => {
    runHook(tmpDir, { session_id: "m1", context_window: { remaining_percentage: 18 } });
    const cache = readCache(tmpDir, "m1");
    expect(cache).not.toBeNull();
    expect(cache.context_critical).toBe(true);
    expect(cache.context_remaining_pct).toBe(18);
  });

  test("remaining=55 → context_critical: false in cache", () => {
    runHook(tmpDir, { session_id: "m2", context_window: { remaining_percentage: 55 } });
    const cache = readCache(tmpDir, "m2");
    expect(cache.context_critical).toBe(false);
  });

  test("remaining=30 (boundary) → context_critical: true (<=)", () => {
    runHook(tmpDir, { session_id: "m3", context_window: { remaining_percentage: 30 } });
    const cache = readCache(tmpDir, "m3");
    expect(cache.context_critical).toBe(true);
  });

  test("remaining=31 → context_critical: false (above default threshold)", () => {
    runHook(tmpDir, { session_id: "m4", context_window: { remaining_percentage: 31 } });
    const cache = readCache(tmpDir, "m4");
    expect(cache.context_critical).toBe(false);
  });
});

describe("rounding — threshold comparison uses rounded value", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("remaining=30.6 rounds to 31 — no warning (just above threshold)", () => {
    const result = runHook(tmpDir, { session_id: "rnd1", context_window: { remaining_percentage: 30.6 } });
    expect(result.stdout).toBe("ctx: 31%");
    const cache = readCache(tmpDir, "rnd1");
    expect(cache.context_critical).toBe(false);
    expect(cache.context_remaining_pct).toBe(31);
  });

  test("remaining=30.4 rounds to 30 — warning fires (at threshold)", () => {
    const result = runHook(tmpDir, { session_id: "rnd2", context_window: { remaining_percentage: 30.4 } });
    expect(result.stdout).toBe("ctx: ⚠ 30%");
    const cache = readCache(tmpDir, "rnd2");
    expect(cache.context_critical).toBe(true);
    expect(cache.context_remaining_pct).toBe(30);
  });
});

describe("stdout output — E2E", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("stdout = 'ctx: ⚠ 18%' when critical", () => {
    const result = runHook(tmpDir, { session_id: "out1", context_window: { remaining_percentage: 18 } });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("ctx: ⚠ 18%");
  });

  test("stdout = 'ctx: 82%' when normal", () => {
    const result = runHook(tmpDir, { session_id: "out2", context_window: { remaining_percentage: 82 } });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("ctx: 82%");
  });

  test("SCAFFOLD_CONTEXT_THRESHOLD=40 → triggers at 38% (above default 30)", () => {
    const result = runHook(
      tmpDir,
      { session_id: "thr1", context_window: { remaining_percentage: 38 } },
      { SCAFFOLD_CONTEXT_THRESHOLD: "40" }
    );
    expect(result.stdout).toBe("ctx: ⚠ 38%");
    const cache = readCache(tmpDir, "thr1");
    expect(cache.context_critical).toBe(true);
  });
});

describe("robustness", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("empty input ({}) → no crash, no cache write, stdout empty", () => {
    const result = runHook(tmpDir, {});
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    const cacheDir = path.join(tmpDir, ".claude/cache");
    const files = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [];
    expect(files).toHaveLength(0);
  });

  test("existing cache keys are preserved (merge, not overwrite)", () => {
    const cacheDir = path.join(tmpDir, ".claude/cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, "checkpoint-merge1.json"),
      JSON.stringify({ hooks: ["foo"], tool_call_count: 42 }),
      "utf8"
    );
    runHook(tmpDir, { session_id: "merge1", context_window: { remaining_percentage: 10 } });
    const cache = readCache(tmpDir, "merge1");
    expect(cache.hooks).toEqual(["foo"]);
    expect(cache.tool_call_count).toBe(42);
    expect(cache.context_critical).toBe(true);
  });
});

describe("unit — main function", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("main() with remaining=15 writes context_critical: true", () => {
    const output = { text: "" };
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s) => { output.text += s; return true; };
    try {
      main(JSON.stringify({ session_id: "unit1", context_window: { remaining_percentage: 15 } }), tmpDir);
    } finally {
      process.stdout.write = origWrite;
    }
    const cache = readCache(tmpDir, "unit1");
    expect(cache.context_critical).toBe(true);
    expect(output.text).toBe("ctx: ⚠ 15%");
  });
});
