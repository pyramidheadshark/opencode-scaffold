# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

Personal Claude Code infrastructure for ML engineering projects — reusable skills, hooks, agents, and templates that enforce the hexagonal architecture + TDD workflow across all Python/FastAPI projects.

---

## Current Phase

- [x] Phase 0: Intake & Requirements
- [x] Phase 1: Design Document
- [x] Phase 2: Environment Setup
- [x] Phase 3: Development Loop
- [x] Phase 4: API Layer & Testing
- [x] Phase 5: CI/CD
- [ ] Phase 6: Deploy (carry to real projects)

**Active phase**: Phase 6 — Deploy (ready for use in real projects)

---

## Backlog

Tasks in priority order. Check off when done.

- [x] Deploy to first real project — verified via TechCon_Passports logs — 2026-03-13
- [ ] Add CI to existing repos: regional-budget (minimal), nalog-parser (minimal), TechCon (fastapi-db), sbera (ml-heavy)

**Completed (most recent first):**
- [x] Proactive UX sprint + RU language fixes: security hint (15 patterns), plan-mode MANDATORY + survey, QUESTION_PREFIXES (можешь/можно), PLAN_MODE_KEYWORDS (внедри/оптимизир/разверни), ONBOARDING_BLOCK×5, CLAUDE.md Task Completion Format — 81 Jest + 37 Python — deployed to 11 repos — 2026-03-13
- [x] README: full English, replace hardcoded paths, fix clone URL, badges, hooks table, add update workflow — 2026-03-06
- [x] Update mechanism: deploy.py --status/--update/--update-all; bootstrapped registry (8 repos); --update-all run — 2026-03-06
- [x] CI debt audit: template [project.optional-dependencies]→[dependency-groups], .pre-commit-config.yaml, ruff-before-commit rule in CLAUDE.md — 2026-03-06
- [x] CI_DEBT.md created in sd_support_suggestions_sbera (53 ruff errors), TechCon_Passports, phs-calorie-app (dep mismatch) — 2026-03-06
- [x] Windows compatibility: session-start.js injects WINDOWS_RULES_BLOCK on win32 (python cmd, PowerShell docs, encoding) — 2026-03-05
- [x] .gitignore: exclude project-config.json and nested .claude/cache/logs — 2026-03-05
- [x] CI/CD standard: 4 profiles + 2 deploy targets, deploy.py --ci-profile/--deploy-target, /new-project wizard — 2026-03-05
- [x] Optimization sprint: 5 phases — 2026-03-04
  - Phase 1: .claudeignore (node_modules, logs, cache, active/, *.jsonl, archives)
  - Phase 2: skill line budget test (300 lines soft limit + check:budget script)
  - Phase 3: SessionStart hook (platform detection, python_cmd, onboarding on first run)
  - Phase 4: Skill efficiency metrics (skill-metrics.jsonl + npm run metrics report)
  - Phase 5: Session cache (skill dedup + status.md hash-check per session)
  - Tests: 35 Python infra, 63 Jest (was 31+37)
- [x] Second iteration: 10 commits — fixes, features, tests, docs — 2026-03-03
  - Ghost dirs removed, Windows stdin fixed, git status --porcelain, rag-vector-db refactor
  - skill-rules: always_load, optional, min_keyword_matches; matchSkills updated
  - New github-actions skill; skill-metadata.json for all 14 skills
  - 37 Jest tests (incl. E2E), 31 Python infra tests; bilingual docs
  - deploy.sh --include-meta; generate_skill_rules.py --exclude-optional
- [x] Convert DOCX docs to Markdown, remove binary files — 2026-03-03
- [x] Add full test suite (24 Jest + 27 Python infra tests) — v0.5.0 — 2026-03-02
- [x] Add `rag-vector-db` skill, `init-design-doc` command, ADRs — v0.4.0 — 2026-03-02
- [x] Add `nlp-slm-patterns` and `predictive-analytics` skills — v0.3.0 — 2026-03-02
- [x] Add 6 ML domain skills (ml-data-handling, htmx-frontend, langgraph-patterns, etc.) — v0.2.0 — 2026-03-02
- [x] Add 4 initial skills, hooks, agents, commands — v0.1.0 — 2026-03-02

---

## Known Issues and Solutions

### Python infra tests UnicodeDecodeError on Windows

**Problem**: `read_text()` uses system default encoding (cp1251) instead of UTF-8
**Root cause**: UTF-8 files with non-ASCII chars trigger cp1251 decode error
**Solution**: Add `encoding="utf-8"` to all `read_text()` and `open()` calls in `test_infra.py`
**Date**: 2026-03-03

---

## Architecture Decisions

| Decision | Choice | Date |
|---|---|---|
| Hook architecture | Pure JS modules (no npm deps) for portability | 2026-03-02 |
| Skill compression | LLMLingua-2 strategy — header extraction + first 50 lines | 2026-03-02 |
| Model routing | Explicit via `multimodal-router` skill, no auto-escalation | 2026-03-02 |
| Test strategy | Jest for hook logic, Python unittest for infra contracts | 2026-03-02 |
| python-project-standards | always_load: true (consumed 1 of 3 skill slots always) | 2026-03-03 |
| Meta-skills | optional: true — never auto-loaded; require --include-meta in deploy | 2026-03-03 |
| min_keyword_matches | langgraph-patterns=2, infra-yandex-cloud=2 (generic keywords) | 2026-03-03 |

---

## Наблюдения по логам TechCon_Passports (2026-03-13)

Проверено на реальных данных из `skill-metrics.jsonl` (22 записи, 2 сессии):

**Что работает корректно:**
- `python-project-standards` загружается на prompt #1 каждой сессии (always_load) — ✅
- `fastapi-patterns` и `test-first-patterns` подхватились по context (18 changed_files в сессии 2) — ✅
- Cache dedup: в сессии 2 все 17+ промптов после первого — `skills: []`, повторной загрузки нет — ✅
- `status_injected: true` только на 1-м промпте сессии (хэш-чек) — ✅

**Потенциальная точка роста:**
- В сессии 2 (19+ промптов) кеш живёт всю сессию — это нормально, но при смене контекста (переход к другой задаче внутри одной сессии) скиллы не обновляются. Пока не критично.

---

## Next Session Plan

1. Fix CI debt in TechCon_Passports — migrate pyproject.toml to [dependency-groups], add mypy + pytest-cov, fix test job
2. Fix CI debt in phs-calorie-app — same dep structure fix
3. Fix CI debt in sd_support_suggestions_sbera — ruff --fix + rename `l` in 3 places (E741)

---

## Files to Know

| File | Purpose |
|---|---|
| `.claude/hooks/skill-activation-logic.js` | Core hook logic (testable, no Node deps) |
| `.claude/hooks/skill-activation-prompt.js` | Entry point for `UserPromptSubmit` hook (+ cache + metrics) |
| `.claude/hooks/session-start.js` | `SessionStart` hook — platform detection + onboarding |
| `scripts/metrics-report.js` | Skill load frequency report (npm run metrics) |
| `.claude/skills/skill-rules.json` | Trigger rules for all 14 skills |
| `tests/hook/skill-activation.test.js` | Jest unit tests (46 tests) |
| `tests/hook/skill-activation-e2e.test.js` | Jest E2E tests (20 tests) |
| `tests/hook/session-start.test.js` | Jest session-start tests (15 tests) |
| `tests/infra/test_infra.py` | Python infra contract tests (37 tests) |
| `docs/ARCHITECTURE.md` | ADRs and design decisions |
| `docs/INTEGRATION.md` | EN integration guide |
| `docs/INTEGRATION.ru.md` | RU integration guide |

---

*Last updated: 2026-03-13 (log audit: TechCon_Passports) by Claude Code*
