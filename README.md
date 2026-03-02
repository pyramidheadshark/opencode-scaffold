# ml-claude-infra

**Claude Code configuration layer for ML engineering projects.**
Plug-and-play skills, hooks, agents, and templates that turn Claude Code into a disciplined ML engineering assistant enforcing hexagonal architecture, TDD-first workflow, and deterministic model routing.

![Jest Tests](https://img.shields.io/badge/Jest-37%20tests-brightgreen)
![Python Tests](https://img.shields.io/badge/Python-31%20tests-blue)
![Skills](https://img.shields.io/badge/skills-14-orange)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What It Does

On every Claude Code prompt, the hook automatically:
1. Injects `dev/status.md` — your project's current state and next steps
2. Matches the prompt against 14 skill rules (keywords + changed files)
3. Injects up to 2 additional relevant skills into `system_prompt_addition`

Skills bring domain knowledge: FastAPI patterns, RAG pipelines, LangGraph graphs, CI/CD configs, test-first workflow — injected only when needed, compressed if large.

---

## Components

### 14 Skills

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
| `infra-yandex-cloud` | terraform + yandex/docker (min 2 keywords) |
| `test-first-patterns` | pytest, BDD, Gherkin, fixtures, coverage |
| `github-actions` | `.github/workflows/*.yml`, CI/CD jobs |
| `design-doc-creator` | *Meta — manual only, not auto-loaded* |
| `skill-developer` | *Meta — manual only, not auto-loaded* |

### 8 Agents

`design-doc-architect` · `test-architect` · `multimodal-analyzer` · `code-reviewer` · `infra-provisioner` · `refactor-planner` · `project-status-reporter` · `debug-assistant`

### 4 Commands

`/init-design-doc` · `/new-project` · `/review` · `/dev-status`

### 3 Hooks

| Hook | Event | Action |
|---|---|---|
| `skill-activation-prompt.js` | UserPromptSubmit | Inject status.md + matched skills |
| `python-quality-check.sh` | PostToolUse | Run ruff + mypy on edited .py files |
| `post-tool-use-tracker.sh` | PostToolUse | Log tool usage to `.claude/logs/` |

---

## Quick Start

### 1. Clone

```bash
git clone <url> ~/tools/ml-claude-infra
cd ~/tools/ml-claude-infra
npm install
```

### 2. Deploy to your project

**Windows / cross-platform (interactive wizard):**
```bash
python scripts/deploy.py
```

**CLI (Linux / macOS / Git Bash):**
```bash
# FastAPI project
./scripts/deploy.sh ~/Repos/my-project \
  --skills python-project-standards,fastapi-patterns,test-first-patterns

# Full ML project
./scripts/deploy.sh ~/Repos/my-project --all --with-tests

# Python CLI (same, cross-platform)
python scripts/deploy.py ~/Repos/my-project --all --with-tests
```

### 3. Configure

```bash
# Copy and adapt the Claude profile
cp .claude/CLAUDE.md ~/Repos/my-project/.claude/CLAUDE.md

# Edit status.md — fill in your project's goal
nano ~/Repos/my-project/dev/status.md
```

### 4. Verify

```bash
cd ~/Repos/my-project
echo '{"prompt":"pyproject.toml ruff setup"}' | node .claude/hooks/skill-activation-prompt.js
# → JSON with python-project-standards in system_prompt_addition
```

---

## Preset Profiles

| Project Type | Skills |
|---|---|
| FastAPI REST API | `python-project-standards`, `fastapi-patterns`, `test-first-patterns`, `github-actions` |
| ML pipeline | `python-project-standards`, `ml-data-handling`, `predictive-analytics`, `test-first-patterns` |
| RAG / LLM app | `fastapi-patterns`, `rag-vector-db`, `langgraph-patterns`, `github-actions` |
| NLP / anonymization | `python-project-standards`, `nlp-slm-patterns`, `test-first-patterns` |
| Full ML platform | `--all` |

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

## Running Tests

```bash
npm run test:hook                  # 37 Jest tests (unit + E2E hook process)
python tests/infra/test_infra.py   # 31 Python infra contract tests
npm test                           # both (Python fallback: python3 || python)
```

---

## Repository Structure

```
ml-claude-infra/
├── .claude/
│   ├── skills/          # 14 skill modules (SKILL.md + resources/ + skill-metadata.json)
│   ├── hooks/           # lifecycle automation
│   ├── agents/          # 8 sub-agents
│   ├── commands/        # 4 slash commands
│   └── CLAUDE.md        # core profile + interaction principles
├── scripts/
│   ├── deploy.py        # cross-platform deploy wizard
│   ├── deploy.sh        # bash deploy script
│   └── generate_skill_rules.py
├── templates/           # pyproject.toml, Dockerfile, docker-compose, Makefile, etc.
├── tests/
│   ├── hook/            # Jest tests
│   ├── infra/           # Python tests
│   └── fixtures/        # mock project for E2E
├── docs/
│   ├── INTEGRATION.md   # deploy guide (EN)
│   ├── INTEGRATION.ru.md # deploy guide (RU)
│   ├── ARCHITECTURE.md  # system overview + ADRs
│   └── CHANGELOG.md
└── dev/
    └── status.md        # session context
```

---

## VS Code Setup

Install for the best experience:
- `anthropic.claude-code` — official Claude Code extension
- `charliermarsh.ruff` — real-time linting
- `eamodio.gitlens` — inline git history
- `usernamehw.errorlens` — inline error display (pairs with mypy)

---

## Docs

- [Integration Guide (EN)](docs/INTEGRATION.md)
- [Integration Guide (RU)](docs/INTEGRATION.ru.md)
- [Architecture + ADRs](docs/ARCHITECTURE.md)
- [Changelog](docs/CHANGELOG.md)
