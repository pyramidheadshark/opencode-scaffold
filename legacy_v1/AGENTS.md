# ARCHIVED — V1 of claude-scaffold CLI (22 skills, 9 agents, 15 commands, 8 hooks). Read-only reference for feature extraction into OpenCode plugins.

## STRUCTURE

```
legacy_v1/
├── .claude/          # Deployed artifacts: agents/, skills/, hooks/, commands/
├── lib/              # CLI runtime: commands/ (15), deploy/, hooks-definition.json, models.js, profiles.js
├── templates/        # Config templates: pre-commit, Docker, profiles/, deps.yaml, INFRA.yaml
├── scripts/          # deploy.py, benchmark/, metrics-report.js, batch operations
├── org-profiles/     # Team-specific CLAUDE.md layers (techcon-ml/)
├── registry/         # Skill registry with trust levels
├── bin/cli.js        # Entry point
└── docs/             # ARCHITECTURE.md, REFERENCE.md, INTEGRATION.md
```

## WHERE TO LOOK

| Need | Location | Key Files |
|------|----------|-----------|
| Skill auto-activation logic | `.claude/hooks/` | `skill-activation-prompt.js`, `skill-activation-logic.js`, `skill-rules.json` |
| Session safety + git snapshots | `.claude/hooks/` | `session-safety.js`, `destructive-patterns.json` |
| Bash output filtering | `.claude/hooks/` | `bash-output-filter.js`, `filter_rules.json` |
| Model routing + mode switching | `lib/commands/mode.js`, `lib/models.js` | `.claude/hooks/mode-detector.js` |
| Multi-repo sync | `lib/commands/update.js`, `lib/commands/status.js` | `deployed-repos.json` |
| Quota tracking | `lib/commands/quota.js` | wraps `ccusage` |
| CLI command implementations | `lib/commands/` | 15 commands: init, update, mode, quota, discover, etc. |
| Agent definitions | `.claude/agents/` | 9 `.md` files with model routing per agent |
| Skill content | `.claude/skills/` | 22 skill dirs + `skill-rules.json` |
| Deploy engine | `lib/deploy/` | copy.js, git.js, registry.js |
| Org profiles | `org-profiles/techcon-ml/` | Survives `update --all` |
| Hook wiring | `lib/hooks-definition.json` | Maps Claude Code events → hook scripts |

## MIGRATION MAP (V1 → OpenCode)

### Migrated
| V1 Feature | OpenCode Replacement | Status |
|------------|---------------------|--------|
| `fastapi-patterns` skill | `opencode/skills/fastapi-patterns/` | ✅ Done |
| `infra-yandex-cloud` skill | `opencode/skills/yc-infra/` | ✅ Done |
| `ml-data-handling` + `predictive-analytics` + `rag-vector-db` | `opencode/skills/ml-pipeline/` | ✅ Merged |
| `python-project-standards` + `test-first-patterns` | `opencode/skills/pre-commit/` | ✅ Merged |
| `bash-output-filter.js` | DCP (Data Compression Protocol) | ✅ Replaced |
| 4 scaffold agents (design-doc-architect, test-architect, code-reviewer, refactor-planner) | oh-my-opencode 7 agents (oracle, hephaestus, metis, momus, explore, librarian, multimodal-looker) | ✅ Replaced |
| `session-safety.js` | `cc-safety-net` plugin | ⚠️ Partial — git snapshots only, no command classification |
| `/review` command | `/review-work` skill | ⚠️ Partial — different architecture |

### No Replacement (Unique — needs extraction)
| V1 Feature | Why Unique | Extraction Priority |
|------------|-----------|-------------------|
| CCR router management (`lib/ccr-config.js`) | Per-repo model routing with 3 modes (default/economy/no-sonnet) | High |
| Model routing modes (`lib/commands/mode.js`) | Global mode switch + per-repo profiles + natural language detection | High |
| Multi-repo sync (`update --all`, `status`) | Central deploy → N repos with drift detection | Medium |
| Skill auto-activation hooks | Keyword + file-pattern + platform triggers, max 3 per session | High |
| Weekly quota tracking (`quota` command) | ccusage integration, budget thresholds, statusbar injection | Low |
| AST RAG indexing | V2 `src/commands/ast.ts` + `scripts/generate_ast.py` — tree-sitter | Medium |
| Org profiles | Team CLAUDE.md layers that survive sync | Low |
| Skill registry | Trust levels (verified/community/untrusted), search, install | Low |
| Session contract + checkpoint | Goal tracking, auto-checkpoint at plan approval | Medium |
| 18 unmigrated skills | langgraph, rag, nlp-slm, htmx, multimodal-router, etc. | Per-need |

### 18 Unmigrated Skills (extraction candidates)
`claude-api-patterns` · `critical-analysis` · `data-validation` · `database-migration-safety` · `design-doc-creator` · `experiment-tracking` · `github-actions` · `htmx-frontend` · `langgraph-patterns` · `ml-data-handling` · `multimodal-router` · `nlp-slm-patterns` · `predictive-analytics` · `prompt-engineering` · `rag-vector-db` · `skill-developer` · `supply-chain-auditor` · `windows-developer`

## ANTI-PATTERNS

- NEVER modify any file in `legacy_v1/` — this is an archived snapshot
- NEVER copy V1 code verbatim into V2 — extract patterns, rewrite in TypeScript ESM
- NEVER assume V1 agents map 1:1 to OpenCode agents — roles and capabilities differ
- NEVER import from `legacy_v1/` in `src/` — reference only, no runtime dependency
- NEVER treat V1 skill content as canonical — verify against current library versions before extraction
