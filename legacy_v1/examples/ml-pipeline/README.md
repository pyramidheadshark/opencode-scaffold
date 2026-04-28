# Example: ml-pipeline

A snapshot of what `npx claude-scaffold init --profile ml-engineer` deploys.

## What's included

- `.claude/CLAUDE.md` — ML Engineer profile (Chip Huyen patterns, hexagonal arch)
- `.claude/skills/` — python-project-standards, ml-data-handling, predictive-analytics, experiment-tracking, rag-vector-db, langgraph-patterns, test-first-patterns
- `.claude/hooks/` — skill-activation-prompt.js, session-start.js, python-quality-check.js, commit-rules-check.js
- `.claude/agents/` — all 8 agents
- `.claude/commands/` — all 4 commands
- `dev/status.md` — session context file

## What Claude Code gets

On every prompt, Claude automatically receives:
1. `dev/status.md` — project state and next steps
2. `python-project-standards` — always loaded
3. Up to 2 additional skills: e.g. `experiment-tracking` triggers on "mlflow"/"experiment", `predictive-analytics` on "sklearn"/"training"

## Workflow supported

```
Design doc → BDD features → TDD tests → Implementation
                                      ↓
                            MLflow experiment tracking
                                      ↓
                            Model registry promotion
```

## How to use

This is a **static snapshot** for reference only. To deploy a live copy:

```bash
npx claude-scaffold init /path/to/your/project --profile ml-engineer
```

---
Generated with claude-scaffold v1.1.0
