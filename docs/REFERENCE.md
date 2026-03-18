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

## CLI Commands

### `init`

```bash
npx claude-scaffold init [target-path] [options]
```

| Flag | Description |
|---|---|
| `--profile <name>` | Base profile: `ml-engineer`, `ai-developer`, `fastapi-developer`, `fullstack` |
| `--lang <lang>` | Language: `en` or `ru` (default: `en`) |
| `--skills <list>` | Comma-separated skill names (overrides profile) |
| `--ci <profile>` | CI profile: `minimal`, `fastapi`, `fastapi-db`, `ml-heavy` |
| `--deploy <target>` | Deploy target: `none`, `yc`, `vps` (default: `none`) |
| `--dry-run` | Preview without writing files |
| `--org-profile <org>` | Org profile name (e.g. `techcon-ml`) |
| `--org-type <type>` | Project type within org (required with `--org-profile`) |

### `update`

```bash
npx claude-scaffold update [target-path]
npx claude-scaffold update --all
```

Updates hooks, agents, commands, skills, and `settings.json`. Does NOT modify `CLAUDE.md`.
Also writes/updates `.scaffold-meta.json` (updates `scaffold_version` and `updated_at`).

### `list-org-profiles`

```bash
npx claude-scaffold list-org-profiles
```

Lists all org profiles found in `org-profiles/` with their project types and descriptions.

### `update-org-profile`

```bash
npx claude-scaffold update-org-profile --org <name> [--repos <paths>] [--lang en|ru]
```

Updates `CLAUDE.md` from org profile templates in registered repos. Reads repo list from `org-profiles/<org>/repos.json` unless `--repos` overrides it. Also updates `.scaffold-meta.json` in each repo.

### `status` / `add-skill` / `metrics`

```bash
npx claude-scaffold status                       # show all registered projects + drift
npx claude-scaffold add-skill <skill> [path]     # add a skill to existing project
npx claude-scaffold metrics                      # skill load frequency from logs
```

---

## `.scaffold-meta.json`

Written to `.claude/.scaffold-meta.json` in the target repo on every `init` and `update`. Automatically gitignored (inside `.claude/`).

```json
{
  "scaffold_version": "87a0b39",
  "base_profile": "ai-developer",
  "org": "techcon-ml",
  "type": "ml-pipeline",
  "deployed_at": "2026-03-18T12:00:00Z",
  "updated_at": "2026-03-18T14:00:00Z"
}
```

Fields `org` and `type` are present only when deployed with `--org-profile`.

---

## Publishing a New Version

1. Bump version in `package.json`
2. Update `README.md` badges
3. Add `NPM_TOKEN` secret in GitHub → Settings → Secrets
4. Push a version tag: `git tag v1.2.0 && git push origin v1.2.0`
5. `publish.yml` runs automatically on tag push
