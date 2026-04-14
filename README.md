# claude-scaffold

**[English](README.md)** | **[Русский](README.ru.md)**

**Claude Code infrastructure for ML and AI engineers — deploy once, sync everywhere, and cut input token costs by 71%.**

Three things in one repo: **scaffolding** (22 skills, profiles, hooks deployed to any project), **token optimization** (bash output filters + context defaults measured at 71.4% savings on Sonnet 4.6), and **multi-repo management** (`update --all` keeps every project in sync with one command).

[![CI](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml/badge.svg)](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-scaffold?label=npm&color=blue)](https://www.npmjs.com/package/claude-scaffold)
[![npm downloads](https://img.shields.io/npm/dm/claude-scaffold?color=blue)](https://www.npmjs.com/package/claude-scaffold)
![Token Savings](https://img.shields.io/badge/token%20savings-71.4%25-brightgreen)
![Jest Tests](https://img.shields.io/badge/Jest-534%20tests-brightgreen)
![Python Tests](https://img.shields.io/badge/Python-59%20tests-blue)
![Skills](https://img.shields.io/badge/skills-22-orange)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

![Demo](docs/demo.gif)

---

## Three Pillars

### 1. Scaffolding — deploy discipline to every project

claude-scaffold is a **central infrastructure layer** you configure once and deploy everywhere. 22 domain skills load automatically based on what you're working on. Profiles adapt the CLAUDE.md for different roles. Hooks enforce quality checks without any manual wiring.

```
claude-scaffold  ← you configure this once
      │
      ├── deploy → project-a/.claude/
      ├── deploy → project-b/.claude/
      └── deploy → project-c/.claude/
```

### 2. Token Optimization — 71.4% input token savings (measured)

v2.1.0 ships a bash output filter hook that wraps verbose commands before they run. Instead of Claude reading 2,000 lines of `pytest` output, it reads the 20 lines that matter.

```
Benchmark: 25 tasks × Sonnet 4.6 via OpenRouter
  Baseline:  25,084 input tokens
  Optimized:  7,178 input tokens
  Savings:      71.4%
```

Also included: `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` context cap as deploy default, `/compact` reminder at call 25, and opt-in `claude-haiku-4-5` routing for administrative agent tasks.

### 3. Multi-Repo Management — one command keeps 29+ projects in sync

```
npx claude-scaffold update --all   # sync all registered projects
npx claude-scaffold update --all --dry-run  # preview what changes
npx claude-scaffold status         # show version drift across projects
```

When you improve a hook, skill, or CLAUDE.md — every project gets it. No copy-pasting, no drift.

---

## Why claude-scaffold?

**Before:** every project has its own CLAUDE.md copied from memory, hooks are not synchronized, each project drifts toward different standards. Token bills grow as Claude reads full `git log` and `pytest` output verbatim.

**After:** one source of truth. Improvements propagate to all projects with one command. Claude reads filtered output — 71% fewer input tokens on measured workloads.

### Why not just copy a CLAUDE.md?

A single CLAUDE.md copy works for one project. claude-scaffold adds:
- **Sync mechanism** — `update --all` keeps every project in sync with one command
- **Output filtering** — bash filter hook cuts input tokens by 71.4% on verbose commands
- **Skill injection** — 22 domain skills loaded automatically per prompt via dynamic line-count budget
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
# Deploy with org profile (team-specific CLAUDE.md)
npx claude-scaffold init /path/to/repo --profile ai-developer --org-profile techcon-ml --org-type ml-pipeline

# List available org profiles and types
npx claude-scaffold list-org-profiles

# Update CLAUDE.md in all org repos (reads org-profiles/<org>/repos.json)
npx claude-scaffold update-org-profile --org techcon-ml

# Override repo list explicitly
npx claude-scaffold update-org-profile --org techcon-ml --repos /path/a,/path/b
```

Org profiles live in `org-profiles/<org-name>/` in the scaffold repo. They are gitignored by default — internal org data stays private.

---

## What It Does

On every Claude Code prompt, the hook automatically:
1. Injects `dev/status.md` — your project's current state and next steps
2. Detects planning intent and reminds to enter plan mode
3. Matches the prompt against 22 skill rules (keywords + changed files + platform triggers)
4. Injects up to 2 additional relevant skills into `system_prompt_addition`
5. On first session with minimal skills installed — suggests `claude-scaffold discover`
6. Checks for session contract (session 2+) — reminds to run `claude-scaffold new-session "goal"`

Skills bring domain knowledge: FastAPI patterns, RAG pipelines, LangGraph graphs, CI/CD configs, test-first workflow — injected only when needed, compressed if large.

---

## Components

### 22 Skills

| Skill | Triggers On |
|---|---|
| `python-project-standards` | **Always loaded** (always_load: true) |
| `critical-analysis` | hypothesis, experiment, bottleneck, рефактор, подход, метрик (≥2 keywords, priority=0) |
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
| `database-migration-safety` | alembic, migration, schema, upgrade/downgrade (≥2 keywords) |
| `supply-chain-auditor` | dependency, CVE, audit, pip install, vulnerable (≥2 keywords) |
| `design-doc-creator` | *Meta — manual only, not auto-loaded* |
| `skill-developer` | *Meta — manual only, not auto-loaded* |

### 9 Agents

`design-doc-architect` · `test-architect` · `multimodal-analyzer` · `code-reviewer` · `infra-provisioner` · `refactor-planner` · `project-status-reporter` · `debug-assistant` · `status-updater`

### 4 Commands

`/init-design-doc` · `/new-project` · `/review` · `/dev-status`

### 7 Hooks

| Hook | Event | Action |
|---|---|---|
| `skill-activation-prompt.js` | UserPromptSubmit | Inject status.md + matched skills + plan-mode reminder |
| `session-safety.js` | PreToolUse | Classify Bash commands (CRITICAL/MODERATE/SAFE), create git snapshots |
| `bash-output-filter.js` | PreToolUse | Wrap verbose commands (pytest, git log, docker build, etc.) with output filters |
| `session-start.js` | SessionStart | Detect platform (win32/unix), inject Windows rules, onboarding |
| `session-checkpoint.js` | PostToolUse | Auto-checkpoint at plan approval or at call 25 (configurable via `SCAFFOLD_COMPACT_THRESHOLD`) |
| `post-tool-use-tracker.js` | PostToolUse | Log tool calls to `.claude/logs/` |
| `python-quality-check.js` | Stop | Run ruff + mypy at session end |

### Session Safety

`session-safety.js` watches every Bash command Claude executes and classifies it as CRITICAL, MODERATE, or SAFE based on patterns in `destructive-patterns.json`.

On every **CRITICAL** command (`git reset --hard`, `rm -rf`, `DROP TABLE`, `curl | bash`, etc.) the hook creates a **git tag recovery point** before the operation runs:

- First snapshot: `claude/s-{session8}`
- Second snapshot in same session: `claude/s-{session8}-2`
- Restore: `git reset --hard claude/s-{session8}`

The notification appears at the top of your next prompt. You can view the audit trail at any time:

```bash
npx claude-scaffold session-logs --tail 20   # last 20 events
npx claude-scaffold session-logs --list       # all sessions
npx claude-scaffold session-logs --session abc12345
```

JSONL logs are written to `.claude/logs/sessions/` (gitignored) and auto-rotated after 30 files.

---

## Preset Profiles

| Project Type | Skills |
|---|---|
| `ml-engineer` | python-project-standards, ml-data-handling, predictive-analytics, rag-vector-db, langgraph-patterns, test-first-patterns |
| `ai-developer` | python-project-standards, fastapi-patterns, multimodal-router, langgraph-patterns, github-actions, test-first-patterns |
| `fastapi-developer` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `fullstack` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `hub` | python-project-standards, critical-analysis, rag-vector-db, prompt-engineering |
| `task-hub` | python-project-standards, critical-analysis |

---

## Skill Registry (v1.6.0+)

Browse, search, and install verified skills from the official registry or community sources:

```bash
npx claude-scaffold registry search "frontend"    # search by name/tags
npx claude-scaffold registry install astro-skill   # download + verify sha256
npx claude-scaffold registry list                  # list all available skills
npx claude-scaffold registry update                # refresh cache from sources
npx claude-scaffold registry add-source "my-org" "https://..." --trust community
```

Trust levels: `verified` (auto-install), `community` (confirmation required), `untrusted` (manual review).

---

## Ecosystem Features (v2.0.0+)

### Cross-Repo Dependencies

Declare dependencies between projects with `deps.yaml` in project root:

```yaml
project: my-project
depends_on:
  - repo: my-hub
    type: knowledge
blockers:
  - id: BLK-001
    description: "Latency issue"
    status: open
```

```bash
npx claude-scaffold deps status                          # show dependency graph
npx claude-scaffold deps add my-hub --type knowledge     # add dependency
npx claude-scaffold deps update-blocker BLK-001 --status resolved
```

Dependencies are injected at session start. Open blockers trigger periodic reminders.

### Infrastructure Manifest

Create `INFRA.yaml` to prevent IP/hostname hallucinations:

```yaml
vms:
  my-server:
    vpc_ip: "192.168.0.10"
    public_ip: "1.2.3.4"
    role: app-server
rules:
  - "NEVER use public IP for intra-host communication"
```

Summary injected at session start. Full manifest via `/infra` command.

### Agent Extensions

Extend base agents with project-specific instructions:

```
.claude/agent-extensions/code-reviewer.md   # appended to base code-reviewer
.claude/agent-extensions/my-agent.md        # fully custom agent
```

Extensions are concatenated with base agents during deploy/update. User extensions are never overwritten.

### Contextual PITFALLS.md

`.claude/PITFALLS.md` contains known pitfalls organized by category (Docker, Terraform, Auth, etc.). Only relevant sections are injected based on changed files and prompt keywords.

---

## Token Optimization (v2.1.0+)

### Bash Output Filter

`bash-output-filter.js` wraps verbose commands with output filters before they run, reducing input token consumption. Matches commands by prefix and appends a grep/tail pipeline:

| Command | Filter Applied |
|---|---|
| `pytest ...` | grep FAILED/PASSED/ERROR + tail -80 |
| `git log ...` | head -30 |
| `docker build ...` | tail -30 |
| `npm install ...` | grep added/removed/vulnerabilities + tail -20 |
| `mypy ...` | grep error/warning/Found + tail -30 |
| `ruff check ...` | tail -25 |

Filter rules are in `.claude/hooks/filter_rules.json` (editable). Audit log at `.claude/logs/filter-log.jsonl`.

**Benchmark result (Sonnet 4.6, 25 tasks):** 71.4% input token savings — baseline 25,084 tokens → optimized 7,178 tokens.

### Context Defaults

`deploySettings()` sets these as one-time defaults on first deploy (never overwrites existing config):

```json
{ "env": { "CLAUDE_CODE_DISABLE_1M_CONTEXT": "1" }, "showClearContextOnPlanAccept": true }
```

### Compact Signal

`session-checkpoint.js` reminds the user to run `/compact` at call 25 (one-shot per session). Configurable:

```bash
SCAFFOLD_COMPACT_THRESHOLD=20 claude  # custom threshold
```

### Agent Model Routing (opt-in)

Set `SCAFFOLD_LIGHT_AGENTS=true` to route administrative tasks (status updates, backlog) to the cost-optimized `status-updater` agent which uses `claude-haiku-4-5-20251001`:

```bash
SCAFFOLD_LIGHT_AGENTS=true claude
```

---

## Session Management (v2.2.0+)

### Session Contract

Track session goals and prevent context drift in long projects:

```bash
claude-scaffold new-session "implement JWT auth"
# → creates dev/active/session-YYYY-MM-DD.md
# → session-start hook reminds if contract is missing on session 2+
```

### Skill Discovery

Auto-detect project stack and find relevant skills from the registry:

```bash
claude-scaffold discover             # detects React, FastAPI, Rust, Go, etc.
claude-scaffold discover frontend    # search by tag
claude-scaffold discover --install   # install top matches automatically
```

On the first session of a new project with minimal skills, `session-start.js` suggests running `discover` automatically.

### Model Router

Switch cost/quality profiles without editing env files:

```bash
claude-scaffold use sonnet           # full quality (default)
claude-scaffold use haiku            # lower cost for routine tasks
claude-scaffold use gemini-flash     # OpenRouter multimodal
claude-scaffold install-aliases      # add shell aliases: use-sonnet, use-haiku, etc.
```

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
│   ├── skills/          # 22 skill modules (SKILL.md + resources/ + skill-metadata.json)
│   ├── hooks/           # lifecycle automation (7 hooks)
│   ├── agents/          # 9 sub-agents
│   ├── commands/        # 5 slash commands
│   └── CLAUDE.md        # core profile + interaction principles
├── scripts/
│   ├── deploy.py        # cross-platform deploy wizard (--status, --update, --update-all)
│   ├── benchmark/
│   │   ├── token_runner.py   # OpenRouter benchmark runner (--mode baseline|optimized)
│   │   ├── tasks.json        # 25 scripted tasks (bash_filter, skill_activation, no_filter_expected)
│   │   ├── gen_tasks.py      # task generator
│   │   └── report.py         # Markdown + embedded PNG report → dev/benchmark-log.md
│   └── metrics-report.js
├── templates/           # pyproject.toml, Dockerfile, docker-compose, GitHub Actions profiles
├── tests/
│   ├── hook/            # Jest hook tests
│   ├── infra/           # Python tests (57 total)
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
npm test                          # 534 Jest + 59 Python
npm run test:hook                 # hook tests only
npm run check:budget              # verify all skills under 300 lines
npm run metrics                   # skill load frequency report

# Benchmark (requires OPENROUTER_API_KEY)
npm run bench:check               # verify SDK + API key
npm run bench:full                # baseline + optimized runs → dev/benchmark-log.md
npm run bench:token               # token measurement only (no report)
npm run bench:report              # generate report from latest JSONL files
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
