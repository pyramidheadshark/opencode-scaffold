"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { classifyCommand, isSafeTarget, isOutOfCwd, main } = require("../../.claude/hooks/session-safety");

const HOOK_PATH = path.resolve(__dirname, "../../.claude/hooks/session-safety.js");
const PATTERNS_PATH = path.resolve(__dirname, "../../.claude/hooks/destructive-patterns.json");
const PATTERNS = JSON.parse(fs.readFileSync(PATTERNS_PATH, "utf8"));

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-safety-test-"));
}

function makeGitDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "session-safety-git-"));
  spawnSync("git", ["init"], { cwd: dir });
  spawnSync("git", ["-c", "user.email=t@t.com", "-c", "user.name=T",
    "commit", "--allow-empty", "-m", "init"], { cwd: dir });
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function readSessionCache(dir, sessionId) {
  const p = path.join(dir, ".claude", "cache", `session-${sessionId}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

describe("isSafeTarget", () => {
  test("matches /tmp in command", () => {
    expect(isSafeTarget("rm -rf /tmp/cs-demo", PATTERNS.safe_targets)).toBe(true);
  });

  test("matches node_modules", () => {
    expect(isSafeTarget("rm -rf node_modules", PATTERNS.safe_targets)).toBe(true);
  });

  test("matches .venv", () => {
    expect(isSafeTarget("rm -rf .venv", PATTERNS.safe_targets)).toBe(true);
  });

  test("matches dist/", () => {
    expect(isSafeTarget("rm -rf dist/", PATTERNS.safe_targets)).toBe(true);
  });

  test("matches __pycache__", () => {
    expect(isSafeTarget("rm -rf __pycache__", PATTERNS.safe_targets)).toBe(true);
  });

  test("returns false for arbitrary project path", () => {
    expect(isSafeTarget("rm -rf /home/user/project/src", PATTERNS.safe_targets)).toBe(false);
  });

  test("returns false for empty command", () => {
    expect(isSafeTarget("", PATTERNS.safe_targets)).toBe(false);
  });
});

describe("classifyCommand", () => {
  test("rm -rf /tmp/cs-demo → SAFE (safe target override)", () => {
    expect(classifyCommand("rm -rf /tmp/cs-demo", PATTERNS)).toBe("SAFE");
  });

  test("rm -rf node_modules → SAFE", () => {
    expect(classifyCommand("rm -rf node_modules", PATTERNS)).toBe("SAFE");
  });

  test("rm -rf dist/ → SAFE", () => {
    expect(classifyCommand("rm -rf dist/", PATTERNS)).toBe("SAFE");
  });

  test("rm -rf .venv → SAFE", () => {
    expect(classifyCommand("rm -rf .venv", PATTERNS)).toBe("SAFE");
  });

  test("rm -rf /c/Users/.../rgs_smart_drive/scripts → CRITICAL", () => {
    expect(classifyCommand("rm -rf /c/Users/user/Repos/rgs_smart_drive/scripts", PATTERNS)).toBe("CRITICAL");
  });

  test("rm -fr ./src → CRITICAL (reversed flags)", () => {
    expect(classifyCommand("rm -fr ./src", PATTERNS)).toBe("CRITICAL");
  });

  test("rm scripts/check.py → MODERATE (no -r flag)", () => {
    expect(classifyCommand("rm scripts/check.py", PATTERNS)).toBe("MODERATE");
  });

  test("git reset --hard → CRITICAL", () => {
    expect(classifyCommand("git reset --hard", PATTERNS)).toBe("CRITICAL");
  });

  test("git reset --hard HEAD~1 → CRITICAL", () => {
    expect(classifyCommand("git reset --hard HEAD~1", PATTERNS)).toBe("CRITICAL");
  });

  test("git push --force → CRITICAL", () => {
    expect(classifyCommand("git push --force", PATTERNS)).toBe("CRITICAL");
  });

  test("git push origin main --force → CRITICAL", () => {
    expect(classifyCommand("git push origin main --force", PATTERNS)).toBe("CRITICAL");
  });

  test("git push --force-with-lease → MODERATE", () => {
    expect(classifyCommand("git push --force-with-lease", PATTERNS)).toBe("MODERATE");
  });

  test("git rebase main → CRITICAL", () => {
    expect(classifyCommand("git rebase main", PATTERNS)).toBe("CRITICAL");
  });

  test("git clean -fd → CRITICAL", () => {
    expect(classifyCommand("git clean -fd", PATTERNS)).toBe("CRITICAL");
  });

  test("DROP TABLE users → CRITICAL", () => {
    expect(classifyCommand("DROP TABLE users", PATTERNS)).toBe("CRITICAL");
  });

  test("TRUNCATE users → CRITICAL", () => {
    expect(classifyCommand("TRUNCATE users", PATTERNS)).toBe("CRITICAL");
  });

  test("ssh yc-ctrl 'rm -rf ~/vhs-demo' → CRITICAL (contains rm -rf)", () => {
    expect(classifyCommand("ssh yc-ctrl 'rm -rf ~/vhs-demo'", PATTERNS)).toBe("CRITICAL");
  });

  test("git stash → MODERATE", () => {
    expect(classifyCommand("git stash", PATTERNS)).toBe("MODERATE");
  });

  test("git rm -r --cached scripts/ → MODERATE", () => {
    expect(classifyCommand("git rm -r --cached scripts/", PATTERNS)).toBe("MODERATE");
  });

  test("ALTER TABLE users ADD COLUMN → MODERATE", () => {
    expect(classifyCommand("ALTER TABLE users ADD COLUMN x INT", PATTERNS)).toBe("MODERATE");
  });

  test("uv run ruff check . → SAFE", () => {
    expect(classifyCommand("uv run ruff check .", PATTERNS)).toBe("SAFE");
  });

  test("uv run pytest → SAFE", () => {
    expect(classifyCommand("uv run pytest", PATTERNS)).toBe("SAFE");
  });

  test("ls -la → SAFE", () => {
    expect(classifyCommand("ls -la", PATTERNS)).toBe("SAFE");
  });

  test("git status → SAFE", () => {
    expect(classifyCommand("git status", PATTERNS)).toBe("SAFE");
  });

  test("empty command → SAFE", () => {
    expect(classifyCommand("", PATTERNS)).toBe("SAFE");
  });

  test("case insensitive: drop table → CRITICAL", () => {
    expect(classifyCommand("drop table users", PATTERNS)).toBe("CRITICAL");
  });
});

describe("isOutOfCwd", () => {
  test("rm -rf / → true (root wipe)", () => {
    expect(isOutOfCwd("rm -rf /", "/home/user/project")).toBe(true);
  });

  test("rm -rf ~ → true (home wipe)", () => {
    expect(isOutOfCwd("rm -rf ~", "/home/user/project")).toBe(true);
  });

  test("rm -rf /tmp/test → false", () => {
    expect(isOutOfCwd("rm -rf /tmp/test", "/home/user/project")).toBe(false);
  });

  test("regular command → false", () => {
    expect(isOutOfCwd("uv run pytest", "/home/user/project")).toBe(false);
  });

  test("git reset --hard → false (no path)", () => {
    expect(isOutOfCwd("git reset --hard", "/home/user/project")).toBe(false);
  });
});

describe("main — return value", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("SAFE command → {action: continue}", () => {
    const r = main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "uv run pytest" }, session_id: "s1" }), tmpDir);
    expect(r.action).toBe("continue");
  });

  test("MODERATE command → {action: continue}", () => {
    const r = main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git stash" }, session_id: "s1" }), tmpDir);
    expect(r.action).toBe("continue");
  });

  test("CRITICAL command in non-git dir → {action: continue} (snapshot skipped gracefully)", () => {
    const r = main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, session_id: "s1" }), tmpDir);
    expect(r.action).toBe("continue");
  });

  test("out-of-cwd rm -rf / → {action: block}", () => {
    const r = main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "rm -rf /" }, session_id: "s1" }), tmpDir);
    expect(r.action).toBe("block");
  });

  test("malformed JSON input → {action: continue}", () => {
    const r = main("{not valid", tmpDir);
    expect(r.action).toBe("continue");
  });

  test("empty input → {action: continue}", () => {
    const r = main("{}", tmpDir);
    expect(r.action).toBe("continue");
  });

  test("missing tool_input → {action: continue}", () => {
    const r = main(JSON.stringify({ tool_name: "Bash", session_id: "s1" }), tmpDir);
    expect(r.action).toBe("continue");
  });
});

describe("main — snapshot logic", () => {
  let gitDir;
  beforeEach(() => { gitDir = makeGitDir(); });
  afterEach(() => {
    try {
      const tags = spawnSync("git", ["tag", "-l", "claude/s-*"], { cwd: gitDir, encoding: "utf8" });
      if (tags.stdout.trim()) {
        tags.stdout.trim().split("\n").forEach(t => {
          spawnSync("git", ["tag", "-d", t.trim()], { cwd: gitDir });
        });
      }
    } catch { }
    cleanup(gitDir);
  });

  test("CRITICAL in git dir → creates snapshot tag", () => {
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, session_id: "test1234" }), gitDir);
    const tags = spawnSync("git", ["tag", "-l", "claude/s-test1234"], { cwd: gitDir, encoding: "utf8" });
    expect(tags.stdout.trim()).toBe("claude/s-test1234");
  });

  test("CRITICAL in git dir → updates session cache with snapshot_taken=true", () => {
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, session_id: "test1234" }), gitDir);
    const cache = readSessionCache(gitDir, "test1234");
    expect(cache.snapshot_taken).toBe(true);
  });

  test("CRITICAL in git dir → stores snapshot_tag in session cache", () => {
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, session_id: "test1234" }), gitDir);
    const cache = readSessionCache(gitDir, "test1234");
    expect(cache.snapshot_tag).toBe("claude/s-test1234");
  });

  test("second CRITICAL → does NOT create a second tag", () => {
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, session_id: "sess5678" }), gitDir);
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "rm -rf /some/path" }, session_id: "sess5678" }), gitDir);
    const tags = spawnSync("git", ["tag", "-l", "claude/s-*"], { cwd: gitDir, encoding: "utf8" });
    expect(tags.stdout.trim().split("\n").filter(Boolean)).toHaveLength(1);
  });

  test("MODERATE → no snapshot tag created", () => {
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git stash" }, session_id: "sess9999" }), gitDir);
    const tags = spawnSync("git", ["tag", "-l", "claude/s-sess9999"], { cwd: gitDir, encoding: "utf8" });
    expect(tags.stdout.trim()).toBe("");
  });

  test("SAFE → no snapshot tag created", () => {
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "uv run pytest" }, session_id: "sessAAA1" }), gitDir);
    const tags = spawnSync("git", ["tag", "-l", "claude/s-sessAAA1"], { cwd: gitDir, encoding: "utf8" });
    expect(tags.stdout.trim()).toBe("");
  });

  test("pre-existing snapshot_taken → skip git tag even for CRITICAL", () => {
    const cacheDir = path.join(gitDir, ".claude", "cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "session-duptest1.json"),
      JSON.stringify({ snapshot_taken: true, snapshot_tag: "claude/s-duptest1" }), "utf8");
    main(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, session_id: "duptest1" }), gitDir);
    const tags = spawnSync("git", ["tag", "-l", "claude/s-duptest1"], { cwd: gitDir, encoding: "utf8" });
    expect(tags.stdout.trim()).toBe("");
  });
});

describe("E2E — spawned process", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("stdout is valid JSON with action field", () => {
    const input = JSON.stringify({ tool_name: "Bash", tool_input: { command: "uv run pytest" }, session_id: "e2e1" });
    const result = spawnSync("node", [HOOK_PATH], { input, encoding: "utf8", cwd: tmpDir });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty("action");
  });

  test("safe command → action: continue", () => {
    const input = JSON.stringify({ tool_name: "Bash", tool_input: { command: "git status" }, session_id: "e2e2" });
    const result = spawnSync("node", [HOOK_PATH], { input, encoding: "utf8", cwd: tmpDir });
    expect(JSON.parse(result.stdout).action).toBe("continue");
  });

  test("empty stdin → action: continue", () => {
    const result = spawnSync("node", [HOOK_PATH], { input: "{}", encoding: "utf8", cwd: tmpDir });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).action).toBe("continue");
  });
});
