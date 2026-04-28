"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { getSessionJsonlPath, appendSessionEvent, deleteOldSessionLogs } = require("../../.claude/hooks/session-utils");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-utils-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("getSessionJsonlPath", () => {
  test("returns path inside .claude/logs/sessions/", () => {
    const p = getSessionJsonlPath("/project", "abc123", "2026-03-21");
    expect(p).toContain(".claude");
    expect(p).toContain("logs");
    expect(p).toContain("sessions");
  });

  test("filename contains date and short session id", () => {
    const p = getSessionJsonlPath("/project", "abc12345extra", "2026-03-21");
    const base = path.basename(p);
    expect(base).toContain("2026-03-21");
    expect(base).toContain("abc12345");
    expect(base).toMatch(/\.jsonl$/);
  });

  test("truncates session id to 8 chars", () => {
    const p = getSessionJsonlPath("/project", "abcdefgh-ijkl-mnop", "2026-01-01");
    expect(path.basename(p)).toContain("abcdefgh");
    expect(path.basename(p)).not.toContain("ijkl");
  });

  test("handles missing session id gracefully", () => {
    const p = getSessionJsonlPath("/project", undefined, "2026-01-01");
    expect(path.basename(p)).toContain("unknown");
  });

  test("uses today's date when dateStr not provided", () => {
    const today = new Date().toISOString().slice(0, 10);
    const p = getSessionJsonlPath("/project", "s1");
    expect(path.basename(p)).toContain(today);
  });
});

describe("appendSessionEvent", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("creates sessions directory if not exists", () => {
    appendSessionEvent(tmpDir, "sess1", { type: "test" });
    const sessDir = path.join(tmpDir, ".claude", "logs", "sessions");
    expect(fs.existsSync(sessDir)).toBe(true);
  });

  test("writes JSON line to file", () => {
    appendSessionEvent(tmpDir, "sess1", { type: "session_start", ts: "2026-01-01" });
    const sessDir = path.join(tmpDir, ".claude", "logs", "sessions");
    const files = fs.readdirSync(sessDir);
    expect(files).toHaveLength(1);
    const content = fs.readFileSync(path.join(sessDir, files[0]), "utf8").trim();
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe("session_start");
  });

  test("appends multiple events to same file", () => {
    const date = new Date().toISOString().slice(0, 10);
    appendSessionEvent(tmpDir, "sess1", { type: "a" });
    appendSessionEvent(tmpDir, "sess1", { type: "b" });
    appendSessionEvent(tmpDir, "sess1", { type: "c" });
    const sessDir = path.join(tmpDir, ".claude", "logs", "sessions");
    const files = fs.readdirSync(sessDir).filter(f => f.includes(date));
    const lines = fs.readFileSync(path.join(sessDir, files[0]), "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[2]).type).toBe("c");
  });

  test("does not throw on invalid cwd", () => {
    expect(() => appendSessionEvent("/nonexistent/path", "s1", { type: "x" })).not.toThrow();
  });
});

describe("deleteOldSessionLogs", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("does not throw when directory does not exist", () => {
    expect(() => deleteOldSessionLogs(path.join(tmpDir, "nonexistent"), 5)).not.toThrow();
  });

  test("does not delete files when count is within limit", () => {
    const dir = path.join(tmpDir, "sessions");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "session-2026-01-01-aaa.jsonl"), "", "utf8");
    fs.writeFileSync(path.join(dir, "session-2026-01-02-bbb.jsonl"), "", "utf8");
    deleteOldSessionLogs(dir, 5);
    expect(fs.readdirSync(dir)).toHaveLength(2);
  });

  test("deletes oldest files when count exceeds limit", () => {
    const dir = path.join(tmpDir, "sessions");
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= 5; i++) {
      fs.writeFileSync(path.join(dir, `session-2026-01-0${i}-xxx.jsonl`), "", "utf8");
    }
    deleteOldSessionLogs(dir, 3);
    const remaining = fs.readdirSync(dir).sort();
    expect(remaining).toHaveLength(3);
    expect(remaining[0]).toContain("2026-01-03");
  });

  test("only deletes session-*.jsonl files, not others", () => {
    const dir = path.join(tmpDir, "sessions");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "session-2026-01-01-aaa.jsonl"), "", "utf8");
    fs.writeFileSync(path.join(dir, "session-2026-01-02-bbb.jsonl"), "", "utf8");
    fs.writeFileSync(path.join(dir, "tool-usage.jsonl"), "", "utf8");
    deleteOldSessionLogs(dir, 1);
    expect(fs.existsSync(path.join(dir, "tool-usage.jsonl"))).toBe(true);
  });
});

describe("appendSessionEvent — JSONL newline safety (T0-3)", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("file path with newlines produces exactly one JSONL line", () => {
    const filePath = "file\nwith\nnewlines.py";
    appendSessionEvent(tmpDir, "sess1", { type: "file_change", path: filePath });
    const sessDir = path.join(tmpDir, ".claude", "logs", "sessions");
    const files = fs.readdirSync(sessDir);
    const content = fs.readFileSync(path.join(sessDir, files[0]), "utf8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).path).toBe(filePath);
  });
});
