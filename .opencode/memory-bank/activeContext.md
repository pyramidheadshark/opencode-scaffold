# Active Context
We are currently in the `v2-rework` branch, building the new `opencode-scaffold` CLI application.

## Current Focus
1. Fixing the Node.js ESM compilation/top-level await error occurring during `node dist/index.js`.
2. Establishing our own Memory Bank to ensure context retention across the session.
3. Ensuring the CLI runs flawlessly, then proceeding to TUI validation and Pre-commit loop wiring.

## Recent Changes
- Scaffolded basic `commander` CLI with `init`, `ast`, `sync-skills`, `telemetry`, and `tower` commands.
- Implemented `ink` TUI logic for `tower` command.
- Set up E2E tests using `vitest` and `execa`.
- Encountered `ERR_REQUIRE_ASYNC_MODULE` from `node dist/index.js` caused by top-level await somewhere in the dependency graph.

## Next Steps
- [ ] Debug the ESM/CJS require error.
- [ ] Validate `tower` E2E test.
- [ ] Prepare standard CLI release format.