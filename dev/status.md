# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

Personal Claude Code infrastructure for ML engineering projects — reusable skills, hooks, agents, and templates that enforce the hexagonal architecture + TDD workflow across all Python/FastAPI projects.

---

## Current Phase

**Active**: Phase 8 — v2.0.0 Ecosystem (2026-04-06) — CODE COMPLETE

4 ecosystem features implemented: deps.yaml, INFRA.yaml, agent extensions, PITFALLS.md. Both v1.6.0 and v2.0.0 committed, npm publish pending user command.

---

## Current State — v2.0.0 code complete (2026-04-06)

- **v2.0.0 code complete**, npm publish only by explicit user command
- 541 tests (424 Jest + 60 benchmark + 57 Python), 0 failed
- **4 ecosystem features**: deps.yaml + CLI, INFRA.yaml + /infra command, agent extensions, PITFALLS.md (contextual)
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

## Active Tasks — v1.6.0 "Registry + Smart Loading"

### Step 1: Dynamic Skill Budget — DONE
- [x] `getSkillSize()` helper + budget_lines logic in skill-activation-logic.js
- [x] `budget_lines: 900` in skill-rules.json, backward compat with maxSkills
- [x] 9 new tests (budget + getSkillSize)

### Step 2: windows-developer Skill + platform_trigger — DONE
- [x] SKILL.md (102 lines) + skill-metadata.json
- [x] platform_trigger in matchSkills, rule priority 22
- [x] 3 platform_trigger tests, benchmark filter for platform skills

### Step 3: New Profiles — DONE
- [x] hub (4 skills) + task-hub (2 skills) in lib/profiles.js
- [x] 2 profile tests in init.test.js

### Step 4: QA Workflow — DONE
- [x] QA RECOMMENDED block before PLAN-MODE in prompt.js
- [x] write_edit_count + plan_mode_entered tracking in post-tool-use-tracker.js
- [x] pending_plan_warning pickup in prompt.js
- [x] 3 E2E tests (QA block order, content, non-plan exclusion)

### Step 5: Skill Registry — DONE
- [x] registry/skills.json — 22 skills with sha256 verification
- [x] lib/registry/sources.js, cache.js, download.js (0 npm deps)
- [x] lib/commands/registry.js (search/install/list/update/add-source)
- [x] Commander subcommand group in bin/cli.js
- [x] Registry fallback hint in add-skill.js
- [x] 18 registry tests (sources, cache, sha256, index integrity)

### Final — DONE
- [x] 509 tests green (392 Jest + 60 benchmark + 57 Python)
- [x] package.json bumped to 1.6.0
- [x] dev/status.md updated

## v1.6.0 — CODE COMPLETE (delayed release)

All 5 features implemented, 509 tests green. Publish via `git tag v1.6.0 && git push origin v1.6.0` when ready.

### New in v1.6.0:
- **Dynamic Skill Budget**: `budget_lines=900` replaces `maxSkills=3`, reads `size_lines` from metadata
- **windows-developer Skill**: auto-loads on win32 via `platform_trigger`, 102 lines
- **hub + task-hub Profiles**: for knowledge hubs and task repos
- **QA Workflow**: soft enforcement with QA block before plan-mode + write/edit warning
- **Skill Registry**: 22 verified skills, CLI commands (search/install/list/update/add-source), sha256 verification, community source support

---

## Active Tasks — v2.0.0 "Ecosystem"

### Feature 1: deps.yaml — DONE
- [x] templates/deps.yaml + minimal YAML parser (no npm deps)
- [x] buildDepsBlock in session-start.js + blocker reminder in checkpoint.js
- [x] CLI: deps status/update-blocker/add/remove + 6 tests

### Feature 2: INFRA.yaml — DONE
- [x] templates/INFRA.yaml + buildInfraBlock in session-start.js
- [x] .claude/commands/infra.md slash command

### Feature 3: Agent Extensions — DONE
- [x] agent-extensions/ dir + .gitkeep in deploy
- [x] mergeAgentExtensions (base + extension concatenation)
- [x] 3 new init tests (dir creation, PITFALLS copy, no-overwrite)

### Feature 4: PITFALLS.md — DONE
- [x] templates/PITFALLS.md (5 categories: Docker, Terraform, Auth, DB, Deploy)
- [x] extractRelevantPitfalls in logic.js + inject in prompt.js
- [x] 5 unit tests for pitfalls matching

### Roadmap (after v1.6.0)
- **v2.0.0** (1-2 weeks): deps.yaml, agent extensions, INFRA.yaml, CLAUDE.md split + PITFALLS.md

---

## Backlog

- [ ] **npm publish v1.6.0** — ONLY by explicit user command: `git tag v1.6.0 && git push origin v1.6.0`
- [ ] Deploy v1.5.0 to 22 repos: `python scripts/deploy.py --update-all` (pending since v1.5.0)
- [ ] Create profile templates for hub/task-hub (`templates/profiles/hub/`, `templates/profiles/task-hub/`)
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
