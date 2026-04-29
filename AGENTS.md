# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-29
**Branch:** v2-rework

## OVERVIEW
CLI scaffolding tool (`opencode-scaffold`) that bootstraps OpenCode project configs — agents, skills, memory-bank, plugins, pre-commit hooks. TypeScript ESM, Commander CLI, Ink TUI.

## STRUCTURE
```
claude-scaffold/
├── src/             # V2 rewrite — 5 commands
│   ├── commands/    # init, ast, skills, telemetry
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
- Global config: `~/.config/opencode/opencode.json` (Z.AI primary, GLM-5.1 orchestrator, GLM-4.7 subagents)
- OmO agent overrides: `~/.config/opencode/oh-my-openagent.jsonc` (explore, librarian, oracle, metis, momus → Z.AI models)
- DCP compaction: `~/.config/opencode/dcp.jsonc` (75%/50% thresholds for GLM-5.1, 70%/45% for GLM-4.7)
- 16 plugins, 6 global MCP (2 local + 4 Z.AI remote) + 5 lazy-loaded via skills, LSP Python (pyright)
- opencode-tool-search: BM25 lazy tool loading, 88% token savings
- opencode-lazy-loader: MCP servers in skill frontmatter, auto-stop after 5min idle
- `legacy_v1/` archived on branch `archive/legacy-v1` — do not modify
- V1 features migration map: see `archive/legacy-v1` branch
- BACKLOG: When OPENAI_API_KEY arrives → add openai provider, Z.AI stays primary
