const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawnSync } = require("child_process");
const {
  main,
  getModelShortName,
  getModelInfo,
  readQuotaCache,
  formatContext,
  formatModel,
  formatQuota,
} = require("../../.claude/hooks/session-status-monitor");

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

function writeSettings(tmpDir, model) {
  const dir = path.join(tmpDir, ".claude");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ model }), "utf8");
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
    expect(result.stdout).toBe("Context: 31%");
    const cache = readCache(tmpDir, "rnd1");
    expect(cache.context_critical).toBe(false);
    expect(cache.context_remaining_pct).toBe(31);
  });

  test("remaining=30.4 rounds to 30 — warning fires (at threshold)", () => {
    const result = runHook(tmpDir, { session_id: "rnd2", context_window: { remaining_percentage: 30.4 } });
    expect(result.stdout).toBe("Context: ⚠ 30%");
    const cache = readCache(tmpDir, "rnd2");
    expect(cache.context_critical).toBe(true);
    expect(cache.context_remaining_pct).toBe(30);
  });
});

describe("stdout output — E2E with new format", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("no model settings → stdout = 'Context: 82%'", () => {
    const result = runHook(tmpDir, { session_id: "out2", context_window: { remaining_percentage: 82 } });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Context: 82%");
  });

  test("critical + no model → 'Context: ⚠ 18%'", () => {
    const result = runHook(tmpDir, { session_id: "out1", context_window: { remaining_percentage: 18 } });
    expect(result.stdout).toBe("Context: ⚠ 18%");
  });

  test("with sonnet model → 'Context: 55% │ 🔵 Sonnet 4.6'", () => {
    writeSettings(tmpDir, "claude-sonnet-4-6");
    const result = runHook(tmpDir, { session_id: "son1", context_window: { remaining_percentage: 55 } });
    expect(result.stdout).toBe("Context: 55% │ 🔵 Sonnet 4.6");
  });

  test("with haiku model → 'Context: 82% │ 🟢 Haiku 4.5'", () => {
    writeSettings(tmpDir, "claude-haiku-4-5-20251001");
    const result = runHook(tmpDir, { session_id: "hai1", context_window: { remaining_percentage: 82 } });
    expect(result.stdout).toBe("Context: 82% │ 🟢 Haiku 4.5");
  });

  test("with opus model + critical → 'Context: ⚠ 18% │ 🟣 Opus 4.6'", () => {
    writeSettings(tmpDir, "claude-opus-4-6");
    const result = runHook(tmpDir, { session_id: "op1", context_window: { remaining_percentage: 18 } });
    expect(result.stdout).toBe("Context: ⚠ 18% │ 🟣 Opus 4.6");
  });

  test("SCAFFOLD_STATUSLINE_PLAIN=1 → fallback без эмодзи", () => {
    writeSettings(tmpDir, "claude-sonnet-4-6");
    const result = runHook(
      tmpDir,
      { session_id: "pl1", context_window: { remaining_percentage: 55 } },
      { SCAFFOLD_STATUSLINE_PLAIN: "1" },
    );
    expect(result.stdout).toBe("Context: 55% | son");
  });

  test("plain mode uses '!' marker for critical", () => {
    const result = runHook(
      tmpDir,
      { session_id: "pl2", context_window: { remaining_percentage: 18 } },
      { SCAFFOLD_STATUSLINE_PLAIN: "1" },
    );
    expect(result.stdout).toBe("Context: ! 18%");
  });

  test("SCAFFOLD_CONTEXT_THRESHOLD=40 → triggers at 38%", () => {
    const result = runHook(
      tmpDir,
      { session_id: "thr1", context_window: { remaining_percentage: 38 } },
      { SCAFFOLD_CONTEXT_THRESHOLD: "40" }
    );
    expect(result.stdout).toBe("Context: ⚠ 38%");
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

describe("unit — formatContext / formatModel / formatQuota", () => {
  test("formatContext without critical", () => {
    expect(formatContext(55, false, false)).toBe("Context: 55%");
  });

  test("formatContext with critical uses ⚠", () => {
    expect(formatContext(18, true, false)).toBe("Context: ⚠ 18%");
  });

  test("formatContext plain uses '!'", () => {
    expect(formatContext(18, true, true)).toBe("Context: ! 18%");
  });

  test("formatModel sonnet has blue circle emoji", () => {
    expect(formatModel({ label: "Sonnet 4.6", emoji: "🔵" }, false)).toBe(" │ 🔵 Sonnet 4.6");
  });

  test("formatModel plain uses short name with pipe", () => {
    expect(formatModel({ label: "Sonnet 4.6", emoji: "🔵", short: "son" }, true)).toBe(" | son");
  });

  test("formatModel null → empty string", () => {
    expect(formatModel(null, false)).toBe("");
  });

  test("formatQuota null → empty string", () => {
    expect(formatQuota(null, false)).toBe("");
  });

  test("formatQuota ok state → green circle", () => {
    expect(formatQuota({ pct: 45, state: "ok" }, false)).toBe(" │ 🟢 Week: 45%");
  });

  test("formatQuota warn state → yellow circle", () => {
    expect(formatQuota({ pct: 85, state: "warn" }, false)).toBe(" │ 🟡 Week: 85%");
  });

  test("formatQuota block state → red circle", () => {
    expect(formatQuota({ pct: 97, state: "block" }, false)).toBe(" │ 🔴 Week: 97%");
  });

  test("formatQuota plain mode", () => {
    expect(formatQuota({ pct: 85, state: "warn" }, true)).toBe(" | Week: ~85%");
  });
});

describe("getModelInfo / getModelShortName (backward compat)", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("getModelShortName returns 'son' for sonnet", () => {
    writeSettings(tmpDir, "claude-sonnet-4-6");
    expect(getModelShortName(tmpDir)).toBe("son");
  });

  test("getModelShortName returns 'hai' for haiku", () => {
    writeSettings(tmpDir, "claude-haiku-4-5-20251001");
    expect(getModelShortName(tmpDir)).toBe("hai");
  });

  test("getModelShortName returns 'ops' for opus", () => {
    writeSettings(tmpDir, "claude-opus-4-6");
    expect(getModelShortName(tmpDir)).toBe("ops");
  });

  test("getModelShortName empty when no settings", () => {
    expect(getModelShortName(tmpDir)).toBe("");
  });

  test("getModelInfo returns label for known model", () => {
    writeSettings(tmpDir, "claude-opus-4-6");
    const info = getModelInfo(tmpDir);
    expect(info.label).toBe("Opus 4.6");
    expect(info.emoji).toBe("🟣");
  });

  test("getModelInfo null when no model key", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".claude", "settings.json"), "{}", "utf8");
    expect(getModelInfo(tmpDir)).toBeNull();
  });
});
