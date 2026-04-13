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

describe("ExitPlanMode trigger", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("returns hookSpecificOutput.additionalContext on ExitPlanMode", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    expect(result.continue).toBe(true);
    expect(result.system_prompt_addition).toBeUndefined();
    expect(result.hookSpecificOutput.additionalContext).toContain("[AUTO CHECKPOINT — Plan Approved]");
  });

  test("additionalContext contains required status sections", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text).toContain("dev/status.md");
    expect(text).toContain("Active phase marker");
    expect(text).toContain("Key architectural decisions");
  });

  test("additionalContext contains compact request before Step 1", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text).toContain("[COMPACT REQUIRED BEFORE STEP 1]");
    expect(text).toContain("/compact");
    expect(text).toContain("Resume Message");
  });

  test("compact gate appears AFTER status write instruction (ordering)", () => {
    const result = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const text = result.hookSpecificOutput.additionalContext;
    expect(text.indexOf("[COMPACT REQUIRED BEFORE STEP 1]")).toBeGreaterThan(text.indexOf("dev/status.md"));
  });

  test("updates last_checkpoint_count in cache on ExitPlanMode", () => {
    main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "s1" }), tmpDir);
    const cache = readCache(tmpDir, "s1");
    expect(cache.tool_call_count).toBe(1);
    expect(cache.last_checkpoint_count).toBe(1);
  });

  test("resets compact_signal_sent after ExitPlanMode", () => {
    const sid = "csr-reset";
    for (let i = 0; i < 25; i++) {
      main(JSON.stringify({ tool_name: "Read", session_id: sid }), tmpDir);
    }
    let cache = readCache(tmpDir, sid);
    expect(cache.compact_signal_sent).toBe(true);
    main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: sid }), tmpDir);
    cache = readCache(tmpDir, sid);
    expect(cache.compact_signal_sent).toBe(false);
  });
});

describe("Threshold trigger", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("no trigger at call 24", () => {
    for (let i = 0; i < 24; i++) {
      main(JSON.stringify({ tool_name: "Read", session_id: "s2" }), tmpDir);
    }
    const cache = readCache(tmpDir, "s2");
    expect(cache.tool_call_count).toBe(24);
    expect(cache.last_checkpoint_count).toBe(0);
  });

  test("triggers at call 25", () => {
    for (let i = 0; i < 24; i++) {
      main(JSON.stringify({ tool_name: "Edit", session_id: "s3" }), tmpDir);
    }
    const result = main(JSON.stringify({ tool_name: "Bash", session_id: "s3" }), tmpDir);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput.additionalContext).toContain("[AUTO CHECKPOINT — Activity Threshold]");
    expect(result.hookSpecificOutput.additionalContext).toContain("[CONTEXT WARNING]");
    expect(result.hookSpecificOutput.additionalContext).toContain("/compact");
  });

  test("threshold updates cache correctly at call 25", () => {
    for (let i = 0; i < 25; i++) {
      main(JSON.stringify({ tool_name: "Read", session_id: "s4" }), tmpDir);
    }
    const cache = readCache(tmpDir, "s4");
    expect(cache.last_checkpoint_count).toBe(25);
    expect(cache.compact_signal_sent).toBe(true);
  });

  test("threshold fires only once (one-shot) — no second trigger without ExitPlanMode", () => {
    for (let i = 0; i < 25; i++) {
      main(JSON.stringify({ tool_name: "Read", session_id: "s-oneshot" }), tmpDir);
    }
    for (let i = 0; i < 25; i++) {
      const r = main(JSON.stringify({ tool_name: "Edit", session_id: "s-oneshot" }), tmpDir);
      expect(r.hookSpecificOutput).toBeUndefined();
    }
  });

  test("ExitPlanMode resets compact_signal_sent — threshold fires again after 25 more calls", () => {
    for (let i = 0; i < 4; i++) {
      main(JSON.stringify({ tool_name: "Read", session_id: "thr-reset" }), tmpDir);
    }
    const r1 = main(JSON.stringify({ tool_name: "ExitPlanMode", session_id: "thr-reset" }), tmpDir);
    expect(r1.hookSpecificOutput.additionalContext).toContain("Plan Approved");

    for (let i = 0; i < 24; i++) {
      const r = main(JSON.stringify({ tool_name: "Edit", session_id: "thr-reset" }), tmpDir);
      expect(r.hookSpecificOutput).toBeUndefined();
    }

    const r2 = main(JSON.stringify({ tool_name: "Bash", session_id: "thr-reset" }), tmpDir);
    expect(r2.hookSpecificOutput.additionalContext).toContain("Activity Threshold");
  });
});

describe("Non-trigger tools", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test.each(["Read", "Edit", "Bash", "Write", "Glob", "Grep", "Agent"])(
    "%s returns only { continue: true }",
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

  test("SCAFFOLD_COMPACT_THRESHOLD=5 fires at call 5", () => {
    for (let i = 0; i < 4; i++) {
      spawnSync("node", [HOOK_PATH], {
        input: JSON.stringify({ tool_name: "Read", session_id: "env-thr" }),
        encoding: "utf8",
        cwd: tmpDir,
        env: { ...process.env, SCAFFOLD_COMPACT_THRESHOLD: "5" },
      });
    }
    const result = spawnSync("node", [HOOK_PATH], {
      input: JSON.stringify({ tool_name: "Bash", session_id: "env-thr" }),
      encoding: "utf8",
      cwd: tmpDir,
      env: { ...process.env, SCAFFOLD_COMPACT_THRESHOLD: "5" },
    });
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain("Activity Threshold");
    expect(output.hookSpecificOutput.additionalContext).toContain("5+");
  });
});
