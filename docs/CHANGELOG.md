# Changelog

All notable changes to `claude-scaffold` are documented here.
Format: [Semantic Versioning](https://semver.org/).

---

## v1.4.0 — 2026-03-22

### Added
- **Session Safety** — `session-safety.js` PreToolUse hook: classifies every Bash command (CRITICAL/MODERATE/SAFE) against `destructive-patterns.json`
- **Per-command git snapshots** — CRITICAL commands trigger `git tag claude/s-{session8}` before execution; subsequent CRITICALs create `-2`, `-3`, ... tags in the same session
- **Pending notification** — snapshot tag + restore instructions injected at the top of next prompt via `pending_notification` in session cache
- **JSONL audit log** — every tool call logged to `.claude/logs/sessions/session-{date}-{id8}.jsonl` with auto-rotation at 30 files
- **Context refresh at weight=30** — `skill-activation-prompt.js` reinjects core rules after long sessions
- **`session-logs` CLI command** — `npx claude-scaffold session-logs --list/--tail/--session`
- **curl|bash CRITICAL patterns** — `curl ... | bash` and `wget ... | sh` classified as CRITICAL
- **`--force-with-lease` MODERATE** — added to `destructive-patterns.json`
- **`sanitizeSessionId`** — path traversal prevention in JSONL filenames and git tag names
- **`isSafeTarget` boundary check** — `rm -rf /node_modules_backup` no longer classified SAFE
- **PATTERNS IIFE** — `destructive-patterns.json` cached at module init, not per-invocation

### Changed
- `session-utils.js` — exports `sanitizeSessionId`; `getSessionJsonlPath` uses it
- `skill-activation-prompt.js` — reads and clears `pending_notification` from session cache on next UserPromptSubmit
- Session cache uses `snapshot_count: int` instead of `snapshot_taken: bool` (backwards compatible)
- `package.json` — version 1.4.0, author, homepage, repository, bugs fields added

### Tests
- 350 Jest + 48 Python (all green)

---

## v1.3.1 — 2026-03-20

### Added
- `docs/demo.gif` — Catppuccin Mocha GIF, rendered via VHS on yc-ctrl VM
- `demo.tape` — VHS tape for reproduction
- `llms.txt` — AI agent discoverability file

---

## v1.3.0 — 2026-03-18

### Added
- **Org profiles** — `org-profiles/<org>/` team-specific CLAUDE.md templates, gitignored
- `lib/commands/org-profile.js` — `loadOrgProfile`, `deployOrgTemplate`, `writeScaffoldMeta`, `listOrgProfiles`, `updateOrgProfile`
- `--org-profile` / `--org-type` flags on `init` command
- `list-org-profiles` and `update-org-profile` CLI commands
- `org-profiles/techcon-ml/` — 4 project types × 2 languages = 8 templates
- 28 new tests in `tests/cli/org-profile.test.js`

---

## v1.2.3 — 2026-03-17

### Changed
- README badges updated, test count 198 → 226

---

## v1.2.2 — 2026-03-16

### Fixed
- Isolate registry writes in CLI tests (no cross-test contamination of `deployed-repos.json`)

---

## v1.2.0 — 2026-03-15

### Added
- Interactive `init` wizard (no-args mode)
- `--dry-run` flag for `init` command
- `add-skill` CLI command — add a skill to an existing deployed project

---

## v1.1.0 — 2026-03-15

### Added
- **Known Pitfalls** sections in all 4 profile templates (EN + RU) — role-specific warnings for Pydantic v2, MLflow context, HTMX scope, Claude API tool_use format
- **New skill: `experiment-tracking`** — MLflow runs, artifact logging, model registry, cross-validation tracking (~180 lines)
- **New skill: `data-validation`** — Pandera schemas, Pydantic data contracts, ML pipeline validation (~150 lines)
- **FastAPI streaming/async section** — SSE for LLM streaming, WebSockets, background tasks, Anthropic streaming
- **`npx claude-scaffold metrics`** command — skill load frequency report from `.claude/logs/skill-metrics.jsonl`
- **Periodic commit rules reminder** in `session-start.js` — injected every 10 sessions
- **GitHub community files** — bug/feature/skill-request issue templates, PR template, Dependabot config
- **`examples/`** directory — fastapi-minimal and ml-pipeline setup snapshots
- **`nbstripout` + `detect-secrets`** added to pre-commit template

### Changed
- **`fullstack` profile** — removed `ml-data-handling` from default skill set (fullstack = FastAPI + HTMX + testing, not ML pipeline)
- **`ml-engineer` profile** — added `experiment-tracking` to default skill set
- **Profile "What You Never Do"** — 3 additional role-specific rules per profile
- **`python-quality-check.js`** — graceful degradation when ruff/mypy not installed
- **CI pipeline** — `npm audit --audit-level=high` added to jest job
- **`ml-heavy.yml` template** — Python 3.11 + 3.12 matrix strategy for test job

### Fixed
- N/A (hardening fixes were part of v1.0.0 pre-release work)

---

## [0.5.0] — 2026-03-02

### Added

- `tests/hook/skill-activation.test.js` — 24 unit tests for skill activation logic (Jest)
- `tests/infra/test_infra.py` — 27 structural integrity tests (Python unittest)
- `tests/SMOKE_TESTS.md` — 7 manual smoke test scenarios for agents and commands
- `.claude/hooks/skill-activation-logic.js` — pure logic module extracted for testability
- `.claude/skills/fastapi-patterns/resources/background-tasks.md` — FastAPI BackgroundTasks + ARQ pattern

### Changed

- `skill-activation-prompt.js` refactored into thin I/O layer over `skill-activation-logic.js`
- `package.json` updated with Jest test scripts (`test`, `test:hook`, `test:infra`, `test:watch`)

### Fixed (found by tests)

- `fastapi-patterns/SKILL.md` referenced `background-tasks.md` which did not exist → created
- `skill-developer/SKILL.md` had placeholder resource references `topic.md` and `*.md` → removed
- `infra-provisioner.md` missing `Workflow` section → added

---

## [0.4.0] — 2026-03-02

### Added

- Skill: rag-vector-db (Qdrant adapter, pgvector, local embeddings, chunking, ingestion pipeline, RAG service, reranking, RAGAS evaluation)
- Command: /init-design-doc (interactive design document wizard)
- docs/ARCHITECTURE.md (10 ADRs covering all major architectural decisions)
- CLAUDE.md updated with full skill/agent/command inventory tables
- skill-rules.json: 13 skills total (added rag-vector-db)
- ml-data-handling: feature-store.md (FeatureCache pattern, drift detection)

---

## [0.3.0] — 2026-03-02

### Added

- Skills (2 new): nlp-slm-patterns (Ollama, vLLM, Presidio, custom NER, quantization), predictive-analytics (sklearn, MLflow, Optuna, SHAP)
- Resources: spacy-ner.md, model-quantization.md, hyperparameter-tuning.md, feature-importance.md
- Resources for existing skills: dependency-injection.md, middleware.md, multi-agent.md
- Agents (2 new): project-status-reporter, debug-assistant
- Templates (3 new): pyproject.toml, .env.example, Makefile
- skill-rules.json: 12 skills total

---

## [0.2.0] — 2026-03-02

### Added

- Skills (6 new, all full): `ml-data-handling`, `htmx-frontend`, `langgraph-patterns`, `infra-yandex-cloud`, `design-doc-creator`, `skill-developer`
- Resources: `ml-data-handling/dvc-alternative.md`, `langgraph-patterns/streaming.md`, `langgraph-patterns/testing-agents.md`, `infra-yandex-cloud/cloud-init.md`, `infra-yandex-cloud/github-actions-deploy.md`
- Agents (3 new): `code-reviewer`, `multimodal-analyzer`, `infra-provisioner`, `refactor-planner`
- Commands (2 new): `/new-project`, `/review`
- `post-tool-use-tracker.sh` hook
- `.claude/settings.json` — hook registration example

### Changed

- `skill-developer/SKILL.md` — added current skill inventory table

---

## [0.1.0] — 2026-03-02

### Added

- `CLAUDE.md` — global ML engineer profile (Hexagonal Architecture, tech stack, model routing)
- Skills: `python-project-standards`, `fastapi-patterns`, `multimodal-router`, `test-first-patterns`
- Skill stubs: `ml-data-handling`, `htmx-frontend`, `langgraph-patterns`, `infra-yandex-cloud`, `design-doc-creator`, `skill-developer`
- `skill-rules.json` — auto-activation rules for all 10 skills
- `skill-activation-prompt.js` hook — UserPromptSubmit hook with status.md injection + skill compression
- `python-quality-check.sh` hook — Stop hook running ruff + mypy
- Agents: `design-doc-architect`, `test-architect`
- Commands: `/dev-status`
- Templates: `design-doc.md`, `status.md`, `Dockerfile`, `docker-compose.yml`
- GitHub Actions workflows: `lint.yml`, `test.yml`, `build.yml`
- `README.md` with VS Code extension recommendations
