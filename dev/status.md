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

Published on npm, deployed to 14 repos. Now focused on organic discovery and community presence.

---

## Current State — v1.4.0 (2026-03-22)

- npm@1.3.1 published, ~500 downloads, main @ uncommitted (v1.4.0 ready to tag+publish)
- 18 skills, 8 agents, 4 commands, 6 hooks (all .js) + session-utils.js
- **350 Jest + 48 Python tests (all green)**
- **v1.4 Session Safety — COMPLETE (Tier 0 hardened, uncommitted)**:
  - `destructive-patterns.json` — CRITICAL/MODERATE/SAFE + curl|bash CRITICAL + --force-with-lease MODERATE
  - `session-utils.js` — sanitizeSessionId + WEIGHTS, JSONL path, appendSessionEvent, log rotation
  - `session-safety.js` — PreToolUse: PATTERNS IIFE, per-command snapshot_count, pending_notification, isSafeTarget boundary check, sanitizeSessionId, timeout=5000
  - `post-tool-use-tracker.js` — weight accumulation + session JSONL init + file_change events
  - `skill-activation-prompt.js` — weight-based context refresh + pending_notification inject+clear
  - `python-quality-check.js` — session_end JSONL event + log rotation
  - `lib/commands/session-logs.js` + `bin/cli.js` — `npx claude-scaffold session-logs`
  - `lib/deploy/copy.js` — PreToolUse hook registration
  - `package.json` — v1.4.0, author, homepage, repository, bugs
  - `docs/CHANGELOG.md` — v1.2.0–v1.4.0 entries added
  - `README.md` — badges (350 Jest), Session Safety section, 6 hooks
  - `llms.txt` — Session Safety section
  - `.gitignore` — dev/*.html, dev/media/
- Demo GIF: `docs/demo.gif` (Catppuccin Mocha, VHS via yc-ctrl, WindowBar Colorful)
- 6 PRs поданы в awesome-листы (все открыты)

---

## Active Tasks

**v1.4.0** — всё готово к коммиту и публикации:
- [x] T0-1: Cache destructive-patterns.json at module init (PATTERNS IIFE)
- [x] T0-2: sanitizeSessionId (path traversal + unify "unknown" default)
- [x] T0-3: JSONL newline — confirmed safe, test added
- [x] T0-4: Per-CRITICAL snapshots (snapshot_count + pending_notification)
- [x] T0-5: isSafeTarget boundary check
- [x] T0-6: curl|bash CRITICAL, --force-with-lease MODERATE patterns
- [x] T0-7: README/CHANGELOG/package.json/llms.txt docs
- [x] T0-8: dev/*.html out of .gitignore
- [ ] Commit + `git tag v1.4.0 && git push origin v1.4.0`

**v1.4.1 Tier 1** (после publish):
- Python infra тесты для session-safety.js + destructive-patterns.json
- Error path тесты (~25% gap)
- Bash weight 0.3 → 0.1
- Magic string константы
- session-logs --list enhanced (duration, event count, snapshot indicator)

---

## Backlog

- [ ] **Multi-agent critique workflow** — before any architectural decision or phase, launch 3–5 subagents with different analytical lenses (security, DX, performance, standards, user behavior). Subagents get explicit hostile framing to avoid cheerleading. Results are surfaced and conflicting findings are explicitly resolved. Should be a reusable `/critique` command or documented workflow in CLAUDE.md dev workflow section. Motivated by v1.4 post-hoc critique session (2026-03-22).
- [ ] Add CI to existing repos: regional-budget (minimal), nalog-parser (minimal), TechCon (fastapi-db), sbera (ml-heavy)
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] Clean deployed-repos.json: remove ~25 temp test entries + duplicate TechCon_Passports
- [ ] v1.4.0: publish to npm after full validation cycle in dev session
- [ ] v1.4.0: update README — mention Session Safety, new `session-logs` command
- [ ] v1.5.0: "safe artifact cleanup" for .sh hooks during update (hash-based, skip if user-modified)

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

---

## Files to Know

| File | Purpose |
|---|---|
| `.claude/hooks/skill-activation-logic.js` | Core hook logic (testable, no Node deps) |
| `.claude/hooks/skill-activation-prompt.js` | UserPromptSubmit entry point (+ cache + metrics) |
| `.claude/hooks/session-start.js` | SessionStart hook — platform detection + onboarding |
| `.claude/skills/skill-rules.json` | Trigger rules for all 18 skills |
| `scripts/make_cast.py` | Programmatic asciinema cast generator for demo GIF |
| `scripts/metrics-report.js` | Skill load frequency report (npm run metrics) |
| `dev/tasks.md` | Current session task list |
| `tests/infra/test_infra.py` | Python infra contract tests (48 tests) |
| `lib/commands/init.js` | deployCore — file ops only, no registry write |
| `.claude/hooks/session-safety.js` | PreToolUse: classifies commands, creates git snapshot on CRITICAL |
| `.claude/hooks/session-utils.js` | Shared: WEIGHTS, getSessionJsonlPath, appendSessionEvent, log rotation |
| `.claude/hooks/destructive-patterns.json` | CRITICAL/MODERATE patterns + safe_targets for session-safety |
| `lib/commands/session-logs.js` | CLI: list/view session JSONL audit logs |

---

*Last updated: 2026-03-22*
