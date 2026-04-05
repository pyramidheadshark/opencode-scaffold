# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

Personal Claude Code infrastructure for ML engineering projects — reusable skills, hooks, agents, and templates that enforce the hexagonal architecture + TDD workflow across all Python/FastAPI projects.

---

## Current Phase

**Active**: Phase 7 — Stability & Ecosystem (v1.5.0 → v2.0.0)

Field feedback from TechCon (371 logs) and RGS (22 repos) ecosystems. Fixing confirmed bugs, adding skill registry, ecosystem features.

---

## Current State — v1.5.0 tagged (2026-04-05)

- **v1.5.0 published**, 473 tests green (356 Jest + 60 benchmark + 57 Python)
- **6 hook bugfixes**, 5 skill trigger fixes, CI template updates, benchmark sync
- **PRs:** 1 MERGED (awesome-claude-code-toolkit#79), 1 CLOSED (awesome-vibe-coding#100), 4 OPEN

### v1.4.1 содержание (всё завершено):
- `critical-analysis` skill v1.1 — 8 ролей, anti-collapse, PLATEAU dual-threshold, 37 keywords, `priority=0`
- `database-migration-safety` skill v1.0 — Alembic checklist, reversibility enforcement
- `supply-chain-auditor` skill v1.0 — dependency hygiene, CVE awareness, pip-audit/npm audit
- `skill-activation-logic.js` — `matchSkills()` теперь сортирует по priority (always_load сначала, затем ascending)
- `batch_deploy_skill.py` — batch deploy critical-analysis + 2 новых скилла в 22 репо
- +3 Python теста: keyword count ≥30, role count =8, trigger simulation (isolated temp git repo)
- README: badges 57 tests / 20 skills; новые строки в таблице скиллов
- `docs/demo.gif` — github-dark theme, показывает critical-analysis skill injection

### Приоритетный фикс (matchSkills sort):
`priority=0` для critical-analysis не работал — правила итерировались в порядке вставки. Теперь: `always_load=true` → гарантированный первый слот; остальные сортируются по priority ascending. Benchmark golden dataset обновлён: `plan-ru-004` теперь ожидает `["critical-analysis", "python-project-standards"]`.

---

## Active Tasks — v1.5.0 "Stability"

### Hook Bugfixes (P0) — ALL DONE
- [x] Fix A: `--force-with-lease` false positive — regex updated
- [x] Fix B: Plan-mode false positives — expanded QUESTION_PREFIXES (13→21 prefixes)
- [x] Fix C: Weight increment — PROMPT_WEIGHT=1 added
- [x] Fix D: Empty catch blocks — 14+ catches now log to stderr
- [x] Fix E: Session ID collision — hash long IDs (md5 → 16 hex chars)
- [x] Fix F: Regex validation at pattern load time

### Skill Trigger Fixes (P1) — ALL DONE
- [x] design-doc-creator: +3 keywords (user story, specification, требовани)
- [x] data-validation: +4 keywords (pydantic, validator, field_validator), min_keyword_matches=2
- [x] prompt-engineering: +3 keywords (system message, instructions, prompt design), +prompts/*.py
- [x] multimodal-router: priority 5→21, min_keyword_matches=2, +2 keywords
- [x] experiment-tracking: +4 keywords (tracking_uri, compare runs, registered model)

### CI & Tests — PARTIAL
- [x] uv sync --all-groups in all 4 CI templates
- [ ] actions/checkout@v4 → v5, setup-node@v4 → v5 (deferred to v1.6.0 — v5 not yet stable)
- [x] Jest tests: +6 new tests (session ID hash, force-with-lease, question prefixes)
- [ ] Python infra error path tests (deferred to v1.5.1)

### Roadmap (after v1.5.0)
- **v1.6.0** (2-3 days): Skill registry (official+community), dynamic budget, QA workflow, windows-developer skill, hub/task-hub profiles
- **v2.0.0** (1-2 weeks): deps.yaml, agent extensions, INFRA.yaml, CLAUDE.md split + PITFALLS.md

---

## Backlog

- [ ] Add CI to existing repos: regional-budget (minimal), nalog-parser (minimal), TechCon (fastapi-db), sbera (ml-heavy)
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] v1.5.0: "safe artifact cleanup" for hooks during update (hash-based, skip if user-modified)
- [ ] coris-landing-site: кастомный скилл `astro-frontend` — перенести в инфру или задокументировать

---

## Known Issues

### VHS не работает на Windows
VHS зависает из-за oh-my-posh в .bashrc (Set Shell bash) или Chrome sandbox.
**Решение**: рендерить через `ssh yc-ctrl`. Зависимости на VM: vhs 0.11.0 + ttyd 1.7.7 + chromium + nodejs + claude-scaffold (sudo). Фикс permissions: `sudo chmod 666 /usr/lib/node_modules/claude-scaffold/deployed-repos.json`. Helper script `/tmp/show-skills.sh` для сложных Type команд в tape.

### Python infra tests UnicodeDecodeError на Windows
`read_text()` использует cp1251 по умолчанию. Фикс: `encoding="utf-8"` везде в `test_infra.py`.

### Trigger simulation test — cwd contamination
Тест запуска hook в INFRA_ROOT захватывал modified test files → `test-first-patterns` заполнял слот раньше critical-analysis. Фикс: запускать в `tempfile.TemporaryDirectory()` с копией только нужных скиллов + `git init`.

### matchSkills priority sort не работал до v1.4.1
`priority=0` не давал преимущества — правила шли в порядке insertion. Фикс в `skill-activation-logic.js`: sort by always_load first, then priority ascending.

---

## Architecture Decisions

| Decision | Choice | Date |
|---|---|---|
| Hook architecture | Pure JS modules (no npm deps) for portability | 2026-03-02 |
| Skill compression | LLMLingua-2 strategy — header extraction + first 50 lines | 2026-03-02 |
| Model routing | Explicit via `multimodal-router` skill, no auto-escalation | 2026-03-02 |
| Test strategy | Jest for hook logic, Python unittest для infra contracts | 2026-03-02 |
| GIF generation | agg (no browser needed) over VHS (Chrome required) | 2026-03-20 |
| Registry isolation | deployCore always requires explicit registryPath in tests | 2026-03-22 |
| Batch deploy via script | `batch_deploy_skill.py` вместо `add-skill` CLI — CLI не сохраняет `priority=0` | 2026-03-23 |
| Priority sort in matchSkills | always_load guaranteed first, then ascending priority — critical-analysis priority=0 wins | 2026-03-23 |

---

## Files to Know

| File | Purpose |
|---|---|
| `.claude/hooks/skill-activation-logic.js` | Core hook logic — matchSkills с priority sort |
| `.claude/hooks/skill-activation-prompt.js` | UserPromptSubmit: skill injection + pending_notification |
| `.claude/hooks/session-safety.js` | PreToolUse (Bash): classifyCommand, git snapshot, sanitizeSessionId |
| `.claude/hooks/session-utils.js` | Shared: WEIGHTS, sanitizeSessionId, JSONL path, appendSessionEvent |
| `.claude/hooks/destructive-patterns.json` | CRITICAL/MODERATE patterns + safe_targets |
| `.claude/hooks/post-tool-use-tracker.js` | PostToolUse: weight accumulation + JSONL session events |
| `.claude/hooks/session-start.js` | SessionStart hook — platform detection + onboarding |
| `.claude/skills/skill-rules.json` | Trigger rules для 20 скиллов |
| `.claude/skills/critical-analysis/SKILL.md` | 8-role SPP auto-critique, priority=0 |
| `.claude/skills/database-migration-safety/SKILL.md` | Alembic migration checklist |
| `.claude/skills/supply-chain-auditor/SKILL.md` | Dependency hygiene + CVE checklist |
| `scripts/batch_deploy_skill.py` | Batch deploy скиллов в все активные репо (сохраняет priority=0) |
| `lib/commands/session-logs.js` | CLI: list/view JSONL session audit logs |
| `lib/commands/init.js` | deployCore — file ops only, no registry write |
| `lib/deploy/registry.js` | loadRegistry / registerDeploy — called by CLI only |
| `tests/infra/test_infra.py` | Python infra contract tests (57 tests) |

---

## Open PRs (публичные репо)

| Repo | PR | Status | Notes |
|---|---|---|---|
| rohitg00/awesome-claude-code-toolkit | #79 | **MERGED** 2026-03-30 | First accepted PR |
| filipecalegario/awesome-vibe-coding | #100 | **CLOSED** 2026-03-29 | "Too early, need community signals" — resubmit after v1.6.0 |
| Prat011/awesome-llm-skills | #56 | open | No comments, 16 days — ping after v1.5.0 |
| ComposioHQ/awesome-claude-plugins | #66 | open | No comments — ping after v1.5.0 |
| thedaviddias/llms-txt-hub | #787 | open | Vercel auth pending |
| jamesmurdza/awesome-ai-devtools | #326 | open | No comments — ping after v1.5.0 |

---

*Last updated: 2026-04-05*
