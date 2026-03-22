# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

Personal Claude Code infrastructure for ML engineering projects — reusable skills, hooks, agents, and templates that enforce the hexagonal architecture + TDD workflow across all Python/FastAPI projects.

---

## Current Phase

**Active**: Phase 6 — Distribution & Growth

Published on npm, deployed to 22 repos. Now focused on organic discovery and community presence.

---

## Current State — v1.4.0 (2026-03-22)

- npm@1.3.1 published, ~500 downloads, main @ `d41f14f`
- **19 skills** (16 auto + 2 meta + 1 new: `critical-analysis`), 8 agents, 4 commands, 6 hooks + session-utils.js
- **350 Jest + 54 Python tests (all green)**
- v1.4.0 code committed (`b661ac3`), awaiting real-world testing before tag+publish
- All 22 repos updated; defectoscopy + hub have critical-analysis skill deployed

### v1.4.0 Session Safety (complete):
- `session-safety.js` — PATTERNS IIFE, per-command `snapshot_count`, `pending_notification`, `isSafeTarget` boundary check, `sanitizeSessionId`, timeout=5000
- `session-utils.js` — `sanitizeSessionId` exported, used in JSONL path
- `destructive-patterns.json` — curl|bash CRITICAL, --force-with-lease MODERATE
- `skill-activation-prompt.js` — `pending_notification` inject+clear on UserPromptSubmit
- `lib/commands/session-logs.js` + `bin/cli.js` — `npx claude-scaffold session-logs`
- `package.json` v1.4.0, author/homepage/repository/bugs fields
- README (350 Jest badge, Session Safety section, 6 hooks), CHANGELOG (v1.2.0–v1.4.0), llms.txt

### Bug fixed this session (`e11c0f4`):
- `update.test.js` — 4 `deployCore` calls без `registryPath` писали в реальный `deployed-repos.json`
- 70 stale `cs-test-*` записей удалены из реестра
- `TestRegistryHealth` в `test_infra.py` — guard от рецидива
- `scripts/clean-registry.js` — утилита ручной очистки

---

## Active Tasks

**Ожидание реального тестирования:**
- [ ] Протестировать Session Safety в реальных репо (день-другой)
- [ ] `git tag v1.4.0 && git push origin v1.4.0` → publish.yml запустится автоматически

**v1.4.1 Tier 1** (после publish):
- Python infra тесты для session-safety.js + destructive-patterns.json
- Error path тесты (~25% gap)
- Bash weight 0.3 → 0.1
- Magic string константы
- session-logs --list enhanced (duration, event count, snapshot indicator)

---

## Backlog

- [x] **`critical-analysis` skill** — 6-role SPP critique (Security, Perf, DA, Crutch, Strategy, ML Auditor). Auto-default behavior. Deployed to defectoscopy + hub. Commit `d41f14f`.
- [ ] Add CI to existing repos: regional-budget (minimal), nalog-parser (minimal), TechCon (fastapi-db), sbera (ml-heavy)
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] v1.5.0: "safe artifact cleanup" for hooks during update (hash-based, skip if user-modified)

---

## Known Issues

### VHS не работает на Windows
VHS зависает из-за oh-my-posh в .bashrc (Set Shell bash) или Chrome sandbox.
**Решение**: рендерить через `ssh yc-ctrl`. Зависимости на VM: vhs 0.11.0 + ttyd 1.7.7 + chromium + nodejs + claude-scaffold (sudo). Фикс permissions: `sudo chmod 666 /usr/lib/node_modules/claude-scaffold/deployed-repos.json`.

### Python infra tests UnicodeDecodeError on Windows
`read_text()` uses cp1251 by default. Fix: `encoding="utf-8"` everywhere in `test_infra.py`.

---

## Architecture Decisions

| Decision | Choice | Date |
|---|---|---|
| Hook architecture | Pure JS modules (no npm deps) for portability | 2026-03-02 |
| Skill compression | LLMLingua-2 strategy — header extraction + first 50 lines | 2026-03-02 |
| Model routing | Explicit via `multimodal-router` skill, no auto-escalation | 2026-03-02 |
| Test strategy | Jest for hook logic, Python unittest for infra contracts | 2026-03-02 |
| GIF generation | agg (no browser needed) over VHS (Chrome required) | 2026-03-20 |
| Registry isolation | deployCore always requires explicit registryPath in tests | 2026-03-22 |

---

## Files to Know

| File | Purpose |
|---|---|
| `.claude/hooks/skill-activation-logic.js` | Core hook logic (testable, no Node deps) |
| `.claude/hooks/skill-activation-prompt.js` | UserPromptSubmit: skill injection + pending_notification |
| `.claude/hooks/session-safety.js` | PreToolUse (Bash): classifyCommand, git snapshot, sanitizeSessionId |
| `.claude/hooks/session-utils.js` | Shared: WEIGHTS, sanitizeSessionId, JSONL path, appendSessionEvent |
| `.claude/hooks/destructive-patterns.json` | CRITICAL/MODERATE patterns + safe_targets |
| `.claude/hooks/post-tool-use-tracker.js` | PostToolUse: weight accumulation + JSONL session events |
| `.claude/hooks/session-start.js` | SessionStart hook — platform detection + onboarding |
| `.claude/skills/skill-rules.json` | Trigger rules for all 19 skills |
| `.claude/skills/critical-analysis/SKILL.md` | 6-role auto-critique: SPP Quick Mode + ML Audit Protocol |
| `scripts/extract_user_messages.py` | Extract user-only messages from Claude JSONL history |
| `lib/commands/session-logs.js` | CLI: list/view JSONL session audit logs |
| `lib/commands/init.js` | deployCore — file ops only, no registry write |
| `lib/deploy/registry.js` | loadRegistry / registerDeploy — called by CLI only |
| `tests/infra/test_infra.py` | Python infra contract tests (49 tests) |
| `scripts/clean-registry.js` | One-shot utility to purge stale cs-test-* entries |

---

*Last updated: 2026-03-22*
