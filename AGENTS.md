# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-29
**Branch:** v2-rework (merged to main)
**Version:** 2.0.0

## OVERVIEW
CLI scaffolding tool (`opencode-scaffold`) that bootstraps OpenCode project configs — agents, skills, memory-bank, plugins, pre-commit hooks. TypeScript ESM, Commander CLI, tsup bundler.

## STRUCTURE
```
opencode-scaffold/
├── src/             # V2 rewrite — 4 commands
│   ├── commands/    # init, ast, skills, telemetry
│   └── templates/   # Embedded configs (opencode-project.jsonc)
├── tests/e2e/       # Vitest + execa integration tests
├── scripts/         # generate_ast.py (tree-sitter indexer)
├── README.md        # English docs (badges, features, attribution)
├── README.ru.md     # Russian docs
└── .opencode/       # Project-level OpenCode config (NOT a template)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a CLI command | `src/commands/` | Export from `src/index.ts`, follow commander pattern |
| Modify init scaffolding | `src/commands/init.ts` | Generates agents, memory-bank, plugins, pre-commit |
| AST indexing | `src/commands/ast.ts` + `scripts/generate_ast.py` | tree-sitter via Python subprocess |
| Skill sync | `src/commands/skills.ts` | Searches `~/.config/opencode/skills/` then TechCon Hub |
| Telemetry | `src/commands/telemetry.ts` | Express + SQLite OTLP server |
| Per-project template | `src/templates/opencode-project.jsonc` | Canonical config deployed to target repos |
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
npx tsc --noEmit     # typecheck
```

## DEPENDENCIES
- Runtime: commander, inquirer, chalk, express, sqlite3
- Dev: typescript, tsup, vitest, execa, @types/*
- Removed (v2): ink, react, @types/react (TUI cancelled)

## GENERATED ARTIFACTS (per target repo)
- `.opencode/agents/` — Architect (glm-5.1), QA/Security/Performance (glm-4.7)
- `.opencode/memory-bank/` — projectbrief, activeContext, progress, systemContext, productContext
- `.opencode/OPENCODE.md` — Entry prompt with memory + orchestration rules
- `.opencode/config.json` — Model, plugins, permissions
- `.opencode/skills/` — Auto-copied based on detected stack
- `.pre-commit-config.yaml` — ruff, mypy, eslint, test gate
- `.opencode-scaffold.json` — Manifest with version + features

## PROVIDER CONFIG
- Provider ID: `zai-coding-plan` (NOT `z-ai`)
- Base URL: `https://api.z.ai/api/coding/paas/v4` (NOT `/api/paas/v4`)
- Models: glm-5.1 (orchestrator), glm-4.7 (subagents)
- Fallback: OpenRouter

## NOTES
- 40 target repos updated and deployed with v2 config
- Skills sync searches `~/.config/opencode/skills/` first, then TechCon Hub WSL path
- `legacy_v1/` archived on branch `archive/legacy-v1` — do not modify
- GitHub release: v2.0.0 with tag and release notes
- BACKLOG: npm publish (`npm publish --access public`), needs name availability check
- BACKLOG: When OPENAI_API_KEY arrives → add openai provider, Z.AI stays primary
