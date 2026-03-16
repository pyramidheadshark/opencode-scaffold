# claude-scaffold

**Claude Code infrastructure for ML/AI projects — deploy once, keep all projects in sync.**

[![CI](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml/badge.svg)](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml)
![npm](https://img.shields.io/badge/npm-v1.2.0-blue)
![Jest Tests](https://img.shields.io/badge/Jest-196%20tests-brightgreen)
![Python Tests](https://img.shields.io/badge/Python-45%20tests-blue)
![Skills](https://img.shields.io/badge/skills-18-orange)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## How It Works

```
claude-scaffold  ← configure once
      │
      ├── deploy → project-a/.claude/
      ├── deploy → project-b/.claude/
      └── deploy → project-c/.claude/

Later: npx claude-scaffold update --all
      → all projects stay in sync automatically
```

On every prompt, the hook injects `dev/status.md` and up to 2 relevant skills from 18 available — only what the current context needs, never a monolithic config file.

You can ask Claude to handle deploys and updates directly:
> *"Deploy claude-scaffold to my new project with the fastapi-developer profile"*

---

## Components

### 18 Skills

| Skill | Triggers On |
|---|---|
| `python-project-standards` | **Always loaded** |
| `fastapi-patterns` | FastAPI, routers, Pydantic |
| `htmx-frontend` | HTMX, Jinja2 templates |
| `ml-data-handling` | pickle, ONNX, Parquet, S3 |
| `multimodal-router` | PDF, DOCX, video, image analysis |
| `langgraph-patterns` | langgraph + state/graph/node |
| `rag-vector-db` | Qdrant, pgvector, embeddings, RAG |
| `nlp-slm-patterns` | Presidio, spaCy, Ollama, vLLM |
| `predictive-analytics` | sklearn, MLflow, Optuna |
| `infra-yandex-cloud` | terraform + yandex/docker |
| `test-first-patterns` | pytest, BDD, Gherkin, coverage |
| `github-actions` | `.github/workflows/*.yml` |
| `claude-api-patterns` | anthropic SDK, tool_use |
| `prompt-engineering` | system_prompt, few_shot, chain-of-thought |
| `experiment-tracking` | MLflow, model registry, log_metric |
| `data-validation` | pandera, great expectations, schema validation |
| `design-doc-creator` | *Meta — manual only* |
| `skill-developer` | *Meta — manual only* |

### 8 Agents

`design-doc-architect` · `test-architect` · `multimodal-analyzer` · `code-reviewer` · `infra-provisioner` · `refactor-planner` · `project-status-reporter` · `debug-assistant`

### 5 Hooks

| Hook | Event | Action |
|---|---|---|
| `skill-activation-prompt.js` | UserPromptSubmit | Inject status.md + matched skills + plan-mode reminder |
| `session-start.js` | SessionStart | Detect platform, inject Windows rules, onboarding |
| `session-checkpoint.js` | PostToolUse | Auto-checkpoint at plan approval or every 50 tool calls |
| `post-tool-use-tracker.js` | PostToolUse | Log tool calls to `.claude/logs/` |
| `python-quality-check.js` | Stop | Run ruff + mypy at session end |

### 4 Commands

`/init-design-doc` · `/new-project` · `/review` · `/dev-status`

### Preset Profiles

| Profile | Skills |
|---|---|
| `ml-engineer` | python-project-standards, ml-data-handling, predictive-analytics, rag-vector-db, langgraph-patterns, test-first-patterns |
| `ai-developer` | python-project-standards, fastapi-patterns, multimodal-router, langgraph-patterns, github-actions, test-first-patterns |
| `fastapi-developer` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `fullstack` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |

---

## Quick Start

```bash
# Interactive wizard
npx claude-scaffold init /path/to/my-project

# One-liner
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

> Python deploy alternative and advanced options: [docs/INTEGRATION.md](docs/INTEGRATION.md)

> See [examples/](examples/) for complete project setup snapshots.

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
npm test                          # 196 Jest + 45 Python
npm run test:hook                 # 134 hook tests only
npm run check:budget              # verify all skills under 300 lines
npm run metrics                   # skill load frequency report
```

---

## Docs

- [Integration Guide (EN)](docs/INTEGRATION.md)
- [Integration Guide (RU)](docs/INTEGRATION.ru.md)
- [Architecture + ADRs](docs/ARCHITECTURE.md)
- [Reference: token budget, model routing, repo structure](docs/REFERENCE.md)
- [Changelog](docs/CHANGELOG.md)
