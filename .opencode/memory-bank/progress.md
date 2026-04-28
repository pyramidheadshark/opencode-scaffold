# Progress
Change log, known bugs, completed tasks, and next steps.

## Done
- [x] Initialized `v2-rework` branch.
- [x] Moved old files to `legacy_v1`.
- [x] Designed `v6.0` architecture with Hybrid Agents (Internal/External).
- [x] Scaffolding CLI with `commander`.
- [x] Added `tsup` build configuration for `ES2022`.
- [x] Wrote `init` command that generates `.opencode/agents/` and Memory Bank files.
- [x] Wrote `sync-skills` command that maps `TechCon_Hub` skills to project.
- [x] Wrote `ast` generation script using `tree-sitter-python`.
- [x] Wrote `tower` TUI command using `ink` React components.
- [x] Set up E2E behavioral tests with `vitest`.

## Bugs & Issues
- 🐛 `ERR_REQUIRE_ASYNC_MODULE` from `ink` library. Since `ink` uses Top-Level Await internally (it is a pure ESM module), we cannot compile our CLI to CommonJS (`require()`). We **must** use strictly ESM output in our project. The error was introduced when we reverted to CommonJS because Node.js could not resolve the internal files in ESM mode without `.js` / `.mjs` extensions.

## Next Phase
Refactor `tsup` configuration to output pure ESM while using the `bundle: true` strategy to prevent missing internal file resolution errors, ensuring `ink` and `execa` work flawlessly. Then validate E2E tests.