# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-29
**Branch:** v2-rework

## OVERVIEW
CLI scaffolding tool (`opencode-scaffold`) that bootstraps OpenCode project configs — agents, skills, memory-bank, plugins, pre-commit hooks. TypeScript ESM, Commander CLI, Ink TUI.

## STRUCTURE
```
claude-scaffold/
├── src/             # V2 rewrite — 5 commands + TUI
│   ├── commands/    # init, ast, skills, telemetry
│   ├── tui/         # Ink/React Control Tower dashboard
│   └── templates/   # Embedded configs (pre-commit, opencode-project)
├── tests/e2e/       # Vitest + execa integration tests
├── scripts/         # generate_ast.py (tree-sitter indexer)
└── .opencode/       # Project-level OpenCode config (NOT a template)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a CLI command | `src/commands/` | Export from `src/index.ts`, follow commander pattern |
| Modify init scaffolding | `src/commands/init.ts` | Generates agents, memory-bank, plugins, pre-commit |
| AST indexing | `src/commands/ast.ts` + `scripts/generate_ast.py` | tree-sitter via Python subprocess |
| TUI dashboard | `src/tui/index.tsx` | Ink/React, polls `.opencode-global-state/` |
| Skill sync | `src/commands/skills.ts` | Copies from TechCon Hub based on detected stack |
| Telemetry | `src/commands/telemetry.ts` | Express + SQLite OTLP server |
| Per-project template | `src/templates/opencode-project.jsonc` | Canonical config for deploying to TechCon repos |
| Project config | `.opencode/` | Current session's config, NOT deployed to target repos |

## CONVENTIONS
- ESM-only: `import X from './Y.js'` (explicit `.js` extensions)
- No comments in code unless explicitly asked
- No Co-Authored-By in commits
- tsup build → single ESM bundle with shebang
- Tests: vitest + execa in `tests/e2e/`
- Pre-commit: ruff + mypy + eslint + test gate

## ANTI-PATTERNS (THIS PROJECT)
- NEVER use `require()` or CommonJS — ESM only
- NEVER add `as any`, `@ts-ignore`, `@ts-expect-error`
- NEVER delete failing tests
- NEVER mock data to make tests pass
- NEVER refactor while fixing a bug
- NEVER leave code in broken state after failures

## COMMANDS
```bash
npm run build        # tsup → dist/index.js
npm test             # vitest run tests/e2e/
npm run lint         # eslint src/
npx tsc --noEmit     # typecheck
```

## NOTES
- Global config: `~/.config/opencode/opencode.json` (GLM-5.1 orchestrator, GPT-5.5 deep-worker)
- `legacy_v1/` archived on branch `archive/legacy-v1` — do not modify
- V1 features migration map: see `archive/legacy-v1` branch
