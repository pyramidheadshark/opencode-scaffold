# Example: fastapi-minimal

A snapshot of what `npx claude-scaffold init --profile fastapi-developer` deploys.

## What's included

- `.claude/CLAUDE.md` — FastAPI Developer profile
- `.claude/skills/` — python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions
- `.claude/hooks/` — skill-activation-prompt.js, session-start.js, python-quality-check.js, commit-rules-check.js
- `.claude/agents/` — all 8 agents
- `.claude/commands/` — all 4 commands
- `dev/status.md` — session context file

## How to use

This is a **static snapshot** for reference only. To deploy a live copy:

```bash
npx claude-scaffold init /path/to/your/project --profile fastapi-developer
```

Then open Claude Code in that directory — hooks activate automatically.

## What Claude Code gets

On every prompt, Claude automatically receives:
1. `dev/status.md` — project state and next steps
2. `python-project-standards` — always loaded
3. Up to 2 additional skills based on your prompt keywords and changed files

---
Generated with claude-scaffold v1.1.0
