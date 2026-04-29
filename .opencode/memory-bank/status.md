# Development Status: opencode-scaffold (v2-rework)

## Design Document Review

The codebase was reviewed against `opencode-scaffold-design.md`. The overall architecture matches the final synthesis (v6.0) strategy: hybrid internal/external agents, a CLI interface with `init`, `ast`, `telemetry`, `sync-skills`, and `tower` commands.

### Issues Addressed & Improvements Made

1. **Path Resolution for Scripts (`ast` command)**:
   - *Bug*: The `packageRoot` logic using `__dirname` combined with `tsup` bundling into `dist/` incorrectly evaluated the root directory relative to the bundled executable, pointing one directory *above* the project root and failing to locate `scripts/generate_ast.py`.
   - *Fix*: Adjusted path resolution to point to the correct parent directory, ensuring the script is located successfully. Added cross-platform checking for `python` vs `python3` invocations.

2. **Package Publishing (`package.json`)**:
   - *Bug*: The project lacked a `files` array, risking missing the `scripts/` directory when distributed via NPM. The `main` field incorrectly pointed to `index.js` instead of `dist/index.js`.
   - *Fix*: Added the `files` array with `["dist", "scripts"]` and corrected `main` to `dist/index.js`.

3. **Sub-agent Orchestration and Plugins (`init` command)**:
   - *Bug*: The design specified that `init` should automatically inject dependencies into `package.json`, but the script was only printing it as a "next step".
   - *Fix*: Updated `init.ts` to actively modify `package.json` (if present), injecting `oh-my-opencode-slim` and `@tarquinen/opencode-dcp` as `devDependencies`. 
   - *Feature*: Automatically injected plugin configurations into the `.opencode/config.json` file.
   - *UX Improvement*: Updated the generated `OPENCODE.md` prompt to explicitly instruct the `Architect` agent to use the `delegateTask_Background` tool provided by `oh-my-opencode-slim` to invoke the created sub-agents.

4. **Cross-repository Knowledge (`sync-skills` command)**:
   - *Bug*: The source path to `TechCon Hub` was hardcoded to a specific user's Windows path.
   - *Fix*: Modified it to prioritize the `TECHCON_HUB_PATH` environment variable, falling back gracefully to the standard path.

5. **Cross-Platform Compatibility**:
   - Standardized `path.join` usage across file writes for Windows/Linux interoperability.
   - Pre-commit bash execution hook properly delegates test commands regardless of the underlying OS structure (works with Git Bash on Windows natively).

## Next Steps
- Commit the changes to `v2-rework`.
- Expand E2E testing scenarios (BDD testing using `Cucumber` and `zx`) as defined in Phase 4 of the design document to further test AST generation, TUI IPC polling, and the Memory Bank loop.