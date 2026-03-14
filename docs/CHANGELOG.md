# Changelog

All notable changes to `claude-scaffold` are documented here.
Format: [Semantic Versioning](https://semver.org/).

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
