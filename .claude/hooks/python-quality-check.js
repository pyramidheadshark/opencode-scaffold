#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function main(inputStr, cwd) {
  const pyprojectPath = path.join(cwd, "pyproject.toml");
  if (!fs.existsSync(pyprojectPath)) {
    return { continue: true };
  }

  const uvCheck = spawnSync("uv", ["--version"], { encoding: "utf8" });
  const useUv = uvCheck.status === 0;

  const ruffCmd = useUv ? "uv" : "ruff";
  const ruffArgs = useUv ? ["run", "ruff", "check", ".", "--quiet"] : ["check", ".", "--quiet"];

  process.stderr.write(">> ruff check...\n");
  const ruff = spawnSync(ruffCmd, ruffArgs, { cwd, encoding: "utf8" });
  const ruffOk = ruff.status === 0;
  process.stderr.write(ruffOk ? "RUFF: OK\n" : "RUFF: issues found. Run 'uv run ruff check . --fix' to auto-fix.\n");

  const srcDir = path.join(cwd, "src");
  let mypyOk = true;
  if (fs.existsSync(srcDir)) {
    const mypyCmd = useUv ? "uv" : "mypy";
    const mypyArgs = useUv ? ["run", "mypy", "src/", "--quiet"] : ["src/", "--quiet"];

    process.stderr.write(">> mypy check...\n");
    const mypy = spawnSync(mypyCmd, mypyArgs, { cwd, encoding: "utf8" });
    mypyOk = mypy.status === 0;
    process.stderr.write(mypyOk ? "MYPY: OK\n" : "MYPY: type errors found.\n");
  }

  if (!ruffOk || !mypyOk) {
    process.stderr.write("\nQuality checks failed. Consider fixing before committing.\n");
    process.stderr.write("This does not block the session — it is a reminder only.\n");
  }

  return { continue: true };
}

if (require.main === module) {
  const inputStr = fs.readFileSync(0, "utf8");
  const result = main(inputStr, process.cwd());
  process.stdout.write(JSON.stringify(result));
}

module.exports = { main };
