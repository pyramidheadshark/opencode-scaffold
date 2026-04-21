# claude-scaffold

**[English](README.md)** | **[Русский](README.ru.md)**

**Claude Code infrastructure for ML and AI engineers — deploy once, sync everywhere, and cut input token costs by 71%.**

Three things in one repo: **scaffolding** (22 skills, profiles, hooks deployed to any project), **token optimization** (bash output filters + context defaults measured at 71.4% savings on Sonnet 4.6), and **multi-repo management** (`update --all` keeps every project in sync with one command).

[![CI](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml/badge.svg)](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-scaffold?label=npm&color=blue)](https://www.npmjs.com/package/claude-scaffold)
[![npm downloads](https://img.shields.io/npm/dm/claude-scaffold?color=blue)](https://www.npmjs.com/package/claude-scaffold)
![Token Savings](https://img.shields.io/badge/token%20savings-71.4%25-brightgreen)
![Jest Tests](https://img.shields.io/badge/Jest-720%2B%20tests-brightgreen)
![Python Tests](https://img.shields.io/badge/Python-68%20tests-blue)
![Skills](https://img.shields.io/badge/skills-22-orange)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

![Demo](docs/demo.gif)

---

## Three Pillars

### 1. Scaffolding — deploy discipline to every project

claude-scaffold is a **central infrastructure layer** you configure once and deploy everywhere. 22 domain skills load automatically based on what you're working on. Profiles adapt CLAUDE.md for different roles. Hooks enforce quality checks without any manual wiring.

```
claude-scaffold  ← you configure this once
      │
      ├── deploy → project-a/.claude/
      ├── deploy → project-b/.claude/
      └── deploy → project-c/.claude/
```

### 2. Token Optimization — 71.4% input token savings (measured)

A bash output filter hook wraps verbose commands before they run. Instead of Claude reading 2,000 lines of `pytest` output, it reads the 20 lines that matter.

```
Benchmark: 25 tasks × Sonnet 4.6 via OpenRouter
  Baseline:  25,084 input tokens
  Optimized:  7,178 input tokens
  Savings:      71.4%
```

### 3. Multi-Repo Management — one command keeps 29+ projects in sync

```
npx claude-scaffold update --all            # sync all registered projects
npx claude-scaffold update --all --dry-run  # preview what changes
npx claude-scaffold status                  # show version drift across projects
```

When you improve a hook, skill, or CLAUDE.md — every project gets it. No copy-pasting, no drift.

---

## Thinking Defaults

Applies Anthropic's recommended thinking settings by default — max effort, adaptive thinking opt-out, full thinking summaries. Written into every deployed `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EFFORT_LEVEL": "max",
    "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1"
  },
  "showThinkingSummaries": true
}
```

Non-overwrite on `init`/`update` (existing user values preserved). Override via CLI:

```bash
npx claude-scaffold init /path --profile ml-engineer \
  --effort medium --adaptive-thinking on --thinking-summaries off
```

Post-deploy explicit overwrite via `tune`:

```bash
npx claude-scaffold tune --effort high           # change effort only
npx claude-scaffold tune --effort off            # remove the key (let Claude Code default apply)
npx claude-scaffold tune --adaptive-thinking on  # re-enable adaptive thinking
```

---

## Quick Start

```bash
# Interactive wizard — asks profile, language, CI, deploy target
npx claude-scaffold init /path/to/my-project

# One-liner with profile
npx claude-scaffold init /path/to/my-project --profile ml-engineer --lang en
```

Profiles: `ml-engineer` · `ai-developer` · `fastapi-developer` · `fullstack` · `hub` · `task-hub`
Languages: `en` · `ru`

```bash
# Edit session context after deploy
code /path/to/my-project/dev/status.md

# Keep all projects in sync
npx claude-scaffold status        # show all registered projects + version drift
npx claude-scaffold update --all  # sync all outdated projects
npx claude-scaffold update /path  # sync a single project
```

> Python deploy alternative (no npm required): [docs/INTEGRATION.md](docs/INTEGRATION.md)

---

## Advanced: Org Profiles (Teams)

For teams with shared conventions — infrastructure topology, naming rules, internal links — org profiles add an organization-specific CLAUDE.md layer on top of scaffold core. This layer survives `update --all` and is updated independently.

```bash
npx claude-scaffold init /path/to/repo --profile ai-developer --org-profile techcon-ml --org-type ml-pipeline
npx claude-scaffold list-org-profiles
npx claude-scaffold update-org-profile --org techcon-ml
npx claude-scaffold update-org-profile --org techcon-ml --repos /path/a,/path/b
```

Org profiles live in `org-profiles/<org-name>/` in the scaffold repo. They are gitignored by default — internal org data stays private.

---

## Features

On every Claude Code prompt, hooks automatically inject `dev/status.md`, match the prompt against 22 skill rules (keywords + changed files + platform triggers), inject up to 2 additional skills, check for a session contract, and suggest `discover` on first session.

### 22 Skills

| Skill | Triggers On |
|---|---|
| `python-project-standards` | **Always loaded** (always_load: true) |
| `critical-analysis` | hypothesis, experiment, bottleneck, рефактор, метрика (≥2 keywords, priority=0) |
| `fastapi-patterns` | FastAPI, routers, endpoints, Pydantic |
| `htmx-frontend` | HTMX, Jinja2 templates, server-side rendering |
| `ml-data-handling` | pickle, ONNX, Parquet, S3, artifacts |
| `multimodal-router` | PDF, DOCX, video, image analysis, Gemini |
| `langgraph-patterns` | langgraph + state/graph/node (≥2 keywords) |
| `rag-vector-db` | Qdrant, pgvector, embeddings, chunking, RAG |
| `nlp-slm-patterns` | Presidio, spaCy, Ollama, vLLM, PII |
| `predictive-analytics` | sklearn, MLflow, Optuna, feature engineering |
| `experiment-tracking` | MLflow, model registry, log_metric, experiment |
| `data-validation` | pandera, great expectations, schema validation |
| `infra-yandex-cloud` | terraform + yandex/docker (≥2 keywords) |
| `test-first-patterns` | pytest, BDD, Gherkin, fixtures, coverage |
| `github-actions` | `.github/workflows/*.yml`, CI/CD jobs |
| `claude-api-patterns` | anthropic SDK, tool_use, MessageCreate |
| `prompt-engineering` | system_prompt, few_shot, chain-of-thought, eval |
| `database-migration-safety` | alembic, migration, schema, upgrade/downgrade (≥2 keywords) |
| `supply-chain-auditor` | dependency, CVE, audit, pip install (≥2 keywords) |
| `design-doc-creator` | *Meta — manual only, not auto-loaded* |
| `skill-developer` | *Meta — manual only, not auto-loaded* |

### 9 Agents · 5 Commands · 8 Hooks

Agents: `design-doc-architect` · `test-architect` · `multimodal-analyzer` · `code-reviewer` · `infra-provisioner` · `refactor-planner` · `project-status-reporter` · `debug-assistant` · `status-updater`

Commands: `/init-design-doc` · `/new-project` · `/review` · `/dev-status` · `/infra`

| Hook | Event | Action |
|---|---|---|
| `skill-activation-prompt.js` | UserPromptSubmit | Inject status.md + matched skills + plan-mode reminder |
| `session-safety.js` | PreToolUse | Classify Bash commands (CRITICAL/MODERATE/SAFE), create git snapshots |
| `bash-output-filter.js` | PreToolUse | Wrap verbose commands with output filters |
| `session-start.js` | SessionStart | Detect platform (win32/unix), inject Windows rules, onboarding |
| `session-checkpoint.js` | PostToolUse | Auto-checkpoint at plan approval; fires compact signal when context is critical |
| `post-tool-use-tracker.js` | PostToolUse (Bash\|Edit\|Write) | Log tool calls to `.claude/logs/` |
| `session-status-monitor.js` | StatusLine | Display `ctx: ⚠ X%` in status bar; writes `context_critical` flag to session cache |
| `python-quality-check.js` | Stop | Run ruff + mypy at session end |

### Session Safety

`session-safety.js` classifies every Bash command as CRITICAL, MODERATE, or SAFE using `destructive-patterns.json`. On CRITICAL commands (`git reset --hard`, `rm -rf`, `DROP TABLE`, `curl | bash`, etc.) the hook creates a git tag recovery point before the operation runs:

- First snapshot: `claude/s-{session8}` · Nth: `claude/s-{session8}-N`
- Restore: `git reset --hard claude/s-{session8}`

Audit trail:

```bash
npx claude-scaffold session-logs --tail 20
npx claude-scaffold session-logs --list
npx claude-scaffold session-logs --session abc12345
```

JSONL logs are written to `.claude/logs/sessions/` (gitignored) and auto-rotated after 30 files.

### Bash Output Filter

Wraps verbose commands with output filters before they run:

| Command | Filter Applied |
|---|---|
| `pytest ...` | grep FAILED/PASSED/ERROR + tail -80 |
| `git log ...` | head -30 |
| `docker build ...` | tail -30 |
| `npm install ...` | grep added/removed/vulnerabilities + tail -20 |
| `mypy ...` | grep error/warning/Found + tail -30 |
| `ruff check ...` | tail -25 |

Rules live in `.claude/hooks/filter_rules.json` (editable). Audit log at `.claude/logs/filter-log.jsonl`.

### Cross-Repo Dependencies · Infrastructure Manifest · Agent Extensions

Declare dependencies between projects with `deps.yaml`; reminders appear at session start for open blockers. Prevent IP/hostname hallucinations with `INFRA.yaml`. Extend base agents via `.claude/agent-extensions/<agent>.md` — concatenated at deploy time, never overwritten.

```bash
npx claude-scaffold deps status
npx claude-scaffold deps add my-hub --type knowledge
npx claude-scaffold deps update-blocker BLK-001 --status resolved
```

### Session Contract · Skill Discovery · Model Router

```bash
claude-scaffold new-session "implement JWT auth"   # track session goals
claude-scaffold discover                           # detect stack + suggest skills
claude-scaffold use sonnet                         # switch active model profile
claude-scaffold install-aliases                    # use-sonnet, use-haiku shell aliases
```

Full details in [docs/REFERENCE.md](docs/REFERENCE.md).

---

## Preset Profiles

| Profile | Skills |
|---|---|
| `ml-engineer` | python-project-standards, ml-data-handling, predictive-analytics, rag-vector-db, langgraph-patterns, test-first-patterns |
| `ai-developer` | python-project-standards, fastapi-patterns, multimodal-router, langgraph-patterns, github-actions, test-first-patterns |
| `fastapi-developer` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `fullstack` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `hub` | python-project-standards, critical-analysis, rag-vector-db, prompt-engineering |
| `task-hub` | python-project-standards, critical-analysis |

---

## Skill Registry

Browse, search, and install verified skills from the official registry or community sources:

```bash
npx claude-scaffold registry search "frontend"
npx claude-scaffold registry install astro-skill
npx claude-scaffold registry list
npx claude-scaffold registry update
npx claude-scaffold registry add-source "my-org" "https://..." --trust community
```

Trust levels: `verified` (auto-install), `community` (confirmation required), `untrusted` (manual review).

---

## Model Routing

### External providers (for non-code tasks)

| Task | Model | Provider |
|---|---|---|
| Code, architecture, tests, refactoring | `claude-sonnet-4-6` | Claude Code subscription |
| PDF / image / video / audio analysis | `google/gemini-3-flash-preview` | OpenRouter |
| Documents > 400k tokens | `google/gemini-3-flash-preview` | OpenRouter |

Routing is **explicit** — triggered manually via `multimodal-router` skill, never automatic.

### Per-repo model routing (v2.6+)

Each registered repo has a **base profile** (`power` / `standard` / `balanced`) that determines which model it uses under each global **mode**:

| Mode | `power` repos | `standard` repos | `balanced` repos |
|------|---------------|------------------|------------------|
| `default` | Sonnet 4.6 | Haiku 4.5 | Sonnet 4.6 |
| `economy` | Haiku 4.5 | Haiku 4.5 | Haiku 4.5 |
| `no-sonnet` | **Opus 4.6** | Haiku 4.5 | Haiku 4.5 |

Switch globally:

```bash
claude-scaffold mode status                  # show active mode + per-repo drift
claude-scaffold mode default                 # sonnet for non-standard repos
claude-scaffold mode economy                 # haiku everywhere (low quota)
claude-scaffold mode no-sonnet               # opus for power repos, haiku for rest
claude-scaffold mode auto-assign             # bulk profile assignment by repo name
claude-scaffold mode set-profile power path/to/repo   # per-repo override
```

You can also **just tell Claude** in natural language — phrases like "переходим в экономный режим", "switch to economy mode", "делаем задачу в no-sonnet" are caught by the `mode-detector` hook and mapped to the right action (persistent mode switch or session-local `/model` swap).

**Hub repos** (base_profile: power) receive an automatic `## [MODE ROUTING GUIDE]` injection on session start, instructing the agent to proactively suggest mode switches based on task complexity.

### Weekly quota tracker (v2.6.1+)

Uses [`ccusage`](https://www.npmjs.com/package/ccusage) (installed as `optionalDependency`) for local analysis of `~/.claude/projects/**/*.jsonl`:

```bash
claude-scaffold quota init-budget       # scaffold ~/.claude/quota-budget.json
claude-scaffold quota status            # weekly usage vs budget
claude-scaffold quota refresh           # force re-scan (bypass 5-min cache)
```

When weekly usage crosses the warn threshold (default 80%) or block threshold (default 95%), the `SessionStart` hook injects a `## [QUOTA WARNING]` block. The statusbar shows `│ 🟡 Week: 85%` or `│ 🔴 Week: 97%` next to context and model.

---

## Deploy Options

### Option A — NPX (no clone needed)

```bash
npx claude-scaffold init /path/to/my-project
npx claude-scaffold init /path/to/my-project --profile ml-engineer --lang en
```

### Option B — Clone and deploy (Python, no npm required)

```bash
git clone https://github.com/pyramidheadshark/claude-scaffold
cd claude-scaffold
python scripts/deploy.py                       # interactive wizard
python scripts/deploy.py /path/to/my-project \
  --skills python-project-standards,fastapi-patterns,test-first-patterns \
  --ci-profile fastapi
```

### Verify the hook works

```bash
cd /path/to/my-project
echo '{"prompt":"pyproject.toml ruff setup"}' | node .claude/hooks/skill-activation-prompt.js
# → JSON with python-project-standards in additionalContext
```

---

## Compatibility

| OS | Node | Python | Status |
|----|------|--------|--------|
| Windows 11 (Git Bash) | ≥18 | ≥3.11 | Tested |
| macOS 14+ | ≥18 | ≥3.11 | Tested |
| Ubuntu 22.04+ | ≥18 | ≥3.11 | Tested |

---

## Running Tests

```bash
npm test                          # 568 Jest + 62 Python
npm run test:hook                 # hook tests only
npm run check:budget              # verify all skills under 300 lines
npm run metrics                   # skill load frequency report

# Benchmark (requires OPENROUTER_API_KEY)
npm run bench:check               # verify SDK + API key
npm run bench:full                # baseline + optimized runs → dev/benchmark-log.md
```

---

## VS Code Setup

- `anthropic.claude-code` — official Claude Code extension
- `charliermarsh.ruff` — real-time linting
- `eamodio.gitlens` — inline git history
- `usernamehw.errorlens` — inline error display (pairs with mypy)

---

## Docs

- [Integration Guide (EN)](docs/INTEGRATION.md) · [RU](docs/INTEGRATION.ru.md)
- [Architecture + ADRs](docs/ARCHITECTURE.md)
- [Reference: token budget, model routing, repo structure](docs/REFERENCE.md)
- [Changelog](docs/CHANGELOG.md)
