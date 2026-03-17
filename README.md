# claude-scaffold

**A Claude Code infrastructure layer for ML and AI engineers — one repo that makes Claude a disciplined engineering partner across all your projects.**

Clone once. Deploy to any project in one command. Update all projects whenever you improve the config — every project stays in sync automatically.

[![CI](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml/badge.svg)](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml)
![npm](https://img.shields.io/badge/npm-v1.2.1-blue)
![Jest Tests](https://img.shields.io/badge/Jest-196%20tests-brightgreen)
![Python Tests](https://img.shields.io/badge/Python-45%20tests-blue)
![Skills](https://img.shields.io/badge/skills-18-orange)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## The Concept

Most Claude Code setups are per-project and drift apart. claude-scaffold is a **central infrastructure layer** that you own and deploy everywhere.

```
claude-scaffold  ← you configure this once
      │
      ├── deploy → project-a/.claude/
      ├── deploy → project-b/.claude/
      └── deploy → project-c/.claude/

Later: npx claude-scaffold update --all
      → all three stay in sync with zero manual work
```

You can ask Claude directly to handle this:
> *"Deploy claude-scaffold to my new project with the fastapi-developer profile"*
> *"Update all registered projects to the latest infra version"*

Claude reads this README, runs the CLI, and wires everything up. No manual config copy-pasting.

---

## Why claude-scaffold?

### Before vs After

**Before:** every project has its own CLAUDE.md copied from memory, hooks are not synchronized, each project drifts toward different standards. When you improve your workflow, you update one project — the rest stay stale.

**After:** one source of truth. `npx claude-scaffold update --all` propagates every improvement to all registered projects simultaneously. Claude reads the same discipline everywhere.

### Why not just copy a CLAUDE.md?

A single CLAUDE.md copy works for one project. claude-scaffold adds:
- **Sync mechanism** — `update --all` keeps every project in sync with one command
- **Skill injection** — 18 domain skills loaded automatically per prompt, not as a single monolithic file
- **Profile system** — different CLAUDE.md per role (ML engineer, FastAPI dev, AI developer, fullstack)
- **Hook infrastructure** — session tracking, onboarding, quality checks, all wired automatically

---

## Quick Start

```bash
# Interactive wizard — asks profile, language, CI, deploy target
npx claude-scaffold init /path/to/my-project

# One-liner with profile
npx claude-scaffold init /path/to/my-project --profile ml-engineer --lang en
```

Profiles: `ml-engineer` · `ai-developer` · `fastapi-developer` · `fullstack`
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

## What It Does

On every Claude Code prompt, the hook automatically:
1. Injects `dev/status.md` — your project's current state and next steps
2. Detects planning intent and reminds to enter plan mode
3. Matches the prompt against 18 skill rules (keywords + changed files)
4. Injects up to 2 additional relevant skills into `system_prompt_addition`

Skills bring domain knowledge: FastAPI patterns, RAG pipelines, LangGraph graphs, CI/CD configs, test-first workflow — injected only when needed, compressed if large.

---

## Components

### 18 Skills

| Skill | Triggers On |
|---|---|
| `python-project-standards` | **Always loaded** (always_load: true) |
| `fastapi-patterns` | FastAPI, routers, endpoints, Pydantic |
| `htmx-frontend` | HTMX, Jinja2 templates, server-side rendering |
| `ml-data-handling` | pickle, ONNX, Parquet, S3, artifacts |
| `multimodal-router` | PDF, DOCX, video, image analysis, Gemini |
| `langgraph-patterns` | langgraph + state/graph/node (min 2 keywords) |
| `rag-vector-db` | Qdrant, pgvector, embeddings, chunking, RAG |
| `nlp-slm-patterns` | Presidio, spaCy, Ollama, vLLM, PII |
| `predictive-analytics` | sklearn, MLflow, Optuna, feature engineering |
| `experiment-tracking` | MLflow, model registry, log_metric, experiment |
| `data-validation` | pandera, great expectations, schema validation |
| `infra-yandex-cloud` | terraform + yandex/docker (min 2 keywords) |
| `test-first-patterns` | pytest, BDD, Gherkin, fixtures, coverage |
| `github-actions` | `.github/workflows/*.yml`, CI/CD jobs |
| `claude-api-patterns` | anthropic SDK, tool_use, MessageCreate |
| `prompt-engineering` | system_prompt, few_shot, chain-of-thought, eval |
| `design-doc-creator` | *Meta — manual only, not auto-loaded* |
| `skill-developer` | *Meta — manual only, not auto-loaded* |

### 8 Agents

`design-doc-architect` · `test-architect` · `multimodal-analyzer` · `code-reviewer` · `infra-provisioner` · `refactor-planner` · `project-status-reporter` · `debug-assistant`

### 4 Commands

`/init-design-doc` · `/new-project` · `/review` · `/dev-status`

### 5 Hooks

| Hook | Event | Action |
|---|---|---|
| `skill-activation-prompt.js` | UserPromptSubmit | Inject status.md + matched skills + plan-mode reminder |
| `session-start.js` | SessionStart | Detect platform (win32/unix), inject Windows rules, onboarding |
| `session-checkpoint.js` | PostToolUse | Auto-checkpoint at plan approval or every 50 tool calls |
| `post-tool-use-tracker.js` | PostToolUse | Log tool calls to `.claude/logs/` |
| `python-quality-check.js` | Stop | Run ruff + mypy at session end |

---

## Preset Profiles

| Project Type | Skills |
|---|---|
| `ml-engineer` | python-project-standards, ml-data-handling, predictive-analytics, rag-vector-db, langgraph-patterns, test-first-patterns |
| `ai-developer` | python-project-standards, fastapi-patterns, multimodal-router, langgraph-patterns, github-actions, test-first-patterns |
| `fastapi-developer` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `fullstack` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |

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

# Interactive wizard
python scripts/deploy.py

# CLI — selected skills + CI profile
python scripts/deploy.py /path/to/my-project \
  --skills python-project-standards,fastapi-patterns,test-first-patterns \
  --ci-profile fastapi
```

### Verify the hook works

```bash
cd /path/to/my-project
echo '{"prompt":"pyproject.toml ruff setup"}' | node .claude/hooks/skill-activation-prompt.js
# → JSON with python-project-standards in system_prompt_addition
```

> See [examples/](examples/) for complete project setup snapshots.

---

## Model Routing

| Task | Model | Provider |
|---|---|---|
| Code, architecture, tests, refactoring | `claude-sonnet-4-6` | Claude Code subscription |
| PDF / image / video / audio analysis | `google/gemini-3-flash-preview` | OpenRouter |
| Documents > 400k tokens | `google/gemini-3-flash-preview` | OpenRouter |

Routing is **explicit** — triggered manually via `multimodal-router` skill, never automatic.

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

---

## Compatibility

| OS | Node | Python | Status |
|----|------|--------|--------|
| Windows 11 (Git Bash) | ≥18 | ≥3.11 | Tested |
| macOS 14+ | ≥18 | ≥3.11 | Tested |
| Ubuntu 22.04+ | ≥18 | ≥3.11 | Tested |

---

## Repository Structure

```
claude-scaffold/
├── .claude/
│   ├── skills/          # 18 skill modules (SKILL.md + resources/ + skill-metadata.json)
│   ├── hooks/           # lifecycle automation (5 hooks)
│   ├── agents/          # 8 sub-agents
│   ├── commands/        # 4 slash commands
│   └── CLAUDE.md        # core profile + interaction principles
├── scripts/
│   ├── deploy.py        # cross-platform deploy wizard (--status, --update, --update-all)
│   └── metrics-report.js
├── templates/           # pyproject.toml, Dockerfile, docker-compose, GitHub Actions profiles
├── tests/
│   ├── hook/            # Jest tests (196 total)
│   ├── infra/           # Python tests (45 total)
│   └── fixtures/        # mock project for E2E
├── docs/
│   ├── INTEGRATION.md   # deploy guide (EN)
│   ├── INTEGRATION.ru.md
│   ├── ARCHITECTURE.md  # system overview + ADRs
│   ├── REFERENCE.md     # token budget, model routing, repo structure
│   └── CHANGELOG.md
└── dev/
    └── status.md        # session context
```

---

## Running Tests

```bash
npm test                          # 196 Jest + 45 Python
npm run test:hook                 # hook tests only
npm run check:budget              # verify all skills under 300 lines
npm run metrics                   # skill load frequency report
```

---

## VS Code Setup

Recommended extensions for the best experience:
- `anthropic.claude-code` — official Claude Code extension
- `charliermarsh.ruff` — real-time linting
- `eamodio.gitlens` — inline git history
- `usernamehw.errorlens` — inline error display (pairs with mypy)

---

## Docs

- [Integration Guide (EN)](docs/INTEGRATION.md)
- [Integration Guide (RU)](docs/INTEGRATION.ru.md)
- [Architecture + ADRs](docs/ARCHITECTURE.md)
- [Reference: token budget, model routing, repo structure](docs/REFERENCE.md)
- [Changelog](docs/CHANGELOG.md)
