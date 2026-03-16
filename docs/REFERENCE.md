# claude-scaffold Reference

Technical details for scaffold contributors and advanced users.

---

## Why claude-scaffold?

### Before vs After

**Before:** every project has its own CLAUDE.md copied from memory, hooks are not synchronized, each project drifts toward different standards. Improving your workflow means updating one project — the rest stay stale.

**After:** one source of truth. `npx claude-scaffold update --all` propagates every improvement to all registered projects simultaneously.

### Why not just copy a CLAUDE.md?

A single CLAUDE.md copy works for one project. claude-scaffold adds:

- **Sync mechanism** — `update --all` keeps every project in sync with one command
- **Skill injection** — 18 domain skills loaded per prompt automatically, not as a monolithic file
- **Profile system** — different CLAUDE.md per role (ML engineer, FastAPI dev, AI developer, fullstack)
- **Hook infrastructure** — session tracking, onboarding, quality checks, auto-checkpointing

---

## Token Budget

| Component | Tokens / prompt |
|---|---|
| `dev/status.md` | ~200 |
| Small skill (< 150 lines) | ~800–1 200 |
| Medium skill (150–250 lines) | ~1 500–2 500 |
| Compressed skill (> 300 lines) | ~600 (headers only) |
| Typical session (status + 2 skills) | ~3 500–5 500 |

On a 200K context window: < 3% overhead per prompt.

Skills above 300 lines are compressed to headers only. Verify budgets: `npm run check:budget`.

---

## Model Routing

| Task | Model | Provider |
|---|---|---|
| Code, architecture, tests, refactoring | `claude-sonnet-4-6` | Claude Code subscription |
| PDF / image / video / audio analysis | `google/gemini-3-flash-preview` | OpenRouter |
| Documents > 400k tokens | `google/gemini-3-flash-preview` | OpenRouter |

Routing is **explicit** — triggered manually via `multimodal-router` skill, never automatic.

---

## Repository Structure

```
claude-scaffold/
├── .claude/
│   ├── skills/          # 18 skill modules (SKILL.md + resources/ + skill-metadata.json)
│   ├── hooks/           # 5 lifecycle hooks (JS, no external deps)
│   ├── agents/          # 8 sub-agents
│   ├── commands/        # 4 slash commands
│   └── CLAUDE.md        # core profile + interaction principles
├── bin/
│   └── cli.js           # npx entry point
├── lib/
│   ├── commands/        # init, update, status, add-skill, metrics
│   ├── deploy/          # copy.js, registry.js, git.js
│   └── profiles.js      # profile definitions
├── scripts/
│   ├── deploy.py        # Python deploy wizard (--status, --update, --update-all)
│   ├── metrics-report.js
│   └── generate_skill_rules.py
├── templates/
│   ├── profiles/        # CLAUDE.md.en + CLAUDE.md.ru per profile
│   └── github-actions/  # CI profiles: minimal, fastapi, fastapi-db, ml-heavy
├── tests/
│   ├── hook/            # Jest tests for hooks
│   ├── cli/             # Jest tests for CLI commands
│   ├── infra/           # Python infra contract tests
│   └── benchmark/       # skill matching precision/recall
├── docs/                # guides + ADRs + this file
├── examples/            # fastapi-minimal, ml-pipeline snapshots
└── dev/
    └── status.md        # session context (loaded on every prompt)
```

---

## VS Code Setup

Recommended extensions:

- `anthropic.claude-code` — official Claude Code extension
- `charliermarsh.ruff` — real-time linting
- `eamodio.gitlens` — inline git history
- `usernamehw.errorlens` — inline error display (pairs with mypy)

---

## Publishing a New Version

1. Bump version in `package.json`
2. Update `README.md` badges
3. Add `NPM_TOKEN` secret in GitHub → Settings → Secrets
4. Push a version tag: `git tag v1.2.0 && git push origin v1.2.0`
5. `publish.yml` runs automatically on tag push
