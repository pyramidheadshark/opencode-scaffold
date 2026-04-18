"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { detectStack, searchRegistry, runDiscover, readJsonKey, readTomlDep } = require("../../lib/commands/discover");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "discover-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const MOCK_REGISTRY = {
  version: "1.0",
  skills: [
    { name: "react-patterns", description: "React component patterns", tags: ["react", "frontend"], trust: "verified" },
    { name: "fastapi-patterns", description: "FastAPI backend patterns", tags: ["fastapi", "python", "backend"], trust: "verified" },
    { name: "htmx-frontend", description: "HTMX + Jinja2 frontend", tags: ["frontend", "htmx"], trust: "verified" },
  ],
};

describe("detectStack", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test("returns react and frontend tags for package.json with react dependency", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" } }), "utf8");
    const tags = detectStack(tmpDir);
    expect(tags).toContain("react");
    expect(tags).toContain("frontend");
  });

  test("returns fastapi python backend tags for pyproject.toml with fastapi", () => {
    fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), '[project]\ndependencies = ["fastapi>=0.100"]\n', "utf8");
    const tags = detectStack(tmpDir);
    expect(tags).toContain("fastapi");
    expect(tags).toContain("python");
    expect(tags).toContain("backend");
  });

  test("returns nodejs tag for package.json without specific deps", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "my-app" }), "utf8");
    const tags = detectStack(tmpDir);
    expect(tags).toContain("nodejs");
  });

  test("returns empty array for empty project with no known files", () => {
    const tags = detectStack(tmpDir);
    expect(tags).toEqual([]);
  });

  test("returns typescript tag for package.json with typescript in devDependencies", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { typescript: "^5.0.0" } }), "utf8");
    const tags = detectStack(tmpDir);
    expect(tags).toContain("typescript");
  });
});

describe("searchRegistry", () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = makeTempDir();
    fs.mkdirSync(path.join(tmpDir, "registry"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "registry", "skills.json"), JSON.stringify(MOCK_REGISTRY), "utf8");
  });
  afterEach(() => { cleanup(tmpDir); });

  test("finds skills with matching tags", () => {
    const results = searchRegistry(tmpDir, ["react"]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("react-patterns");
  });

  test("sorts results by number of matching tags descending", () => {
    const results = searchRegistry(tmpDir, ["python", "backend", "fastapi"]);
    expect(results[0].matchCount).toBeGreaterThanOrEqual(results[1] ? results[1].matchCount : 0);
    expect(results[0].name).toBe("fastapi-patterns");
  });

  test("returns empty array when no skills match", () => {
    const results = searchRegistry(tmpDir, ["rust", "go"]);
    expect(results).toEqual([]);
  });

  test("returns only matching skills, not all skills", () => {
    const results = searchRegistry(tmpDir, ["python"]);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("fastapi-patterns");
  });
});

describe("runDiscover — output", () => {
  let tmpDir;
  let logSpy;

  beforeEach(() => {
    tmpDir = makeTempDir();
    fs.mkdirSync(path.join(tmpDir, "registry"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "registry", "skills.json"), JSON.stringify(MOCK_REGISTRY), "utf8");
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    cleanup(tmpDir);
  });

  test("prints table when matches found", () => {
    const projectDir = makeTempDir();
    try {
      fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" } }), "utf8");
      runDiscover(tmpDir, projectDir, {});
      const output = logSpy.mock.calls.map(c => c[0]).join("\n");
      expect(output).toContain("react-patterns");
    } finally {
      cleanup(projectDir);
    }
  });

  test("prints no matching skills message when nothing found", () => {
    const projectDir = makeTempDir();
    try {
      runDiscover(tmpDir, projectDir, {});
      const output = logSpy.mock.calls.map(c => c[0]).join("\n");
      expect(output).toMatch(/no stack detected/i);
    } finally {
      cleanup(projectDir);
    }
  });

  test("opts.query searches by given tag, ignoring detectStack", () => {
    runDiscover(tmpDir, tmpDir, { query: "frontend" });
    const output = logSpy.mock.calls.map(c => c[0]).join("\n");
    expect(output).toContain("frontend");
    expect(output).toMatch(/react-patterns|htmx-frontend/);
  });
});
