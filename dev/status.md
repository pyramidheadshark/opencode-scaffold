# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

Personal Claude Code infrastructure for ML engineering projects — reusable skills, hooks, agents, and templates that enforce the hexagonal architecture + TDD workflow across all Python/FastAPI projects.

Positioned around three pillars: **scaffolding** (deploy + sync), **token optimization** (71.4% savings measured), **multi-repo management** (update --all).

---

## Current Phase

**P0 Overhaul — Session 1 DONE, Session 2 pending.**

Session 1 (A2 + Post-Compact Resume) committed to main (`137cfca`). Deploy to 29 repos pending.
Next: Session 2 (B1, B2, D1, D2, D3) — skill re-injection audit + model router.

---

## P0 Overhaul Plan (2026-04-13)

Full plan: `C:\Users\pyramidheadshark\.claude\plans\functional-squishing-hinton.md`

| Session | Phases | Status | Notes |
|---------|--------|--------|-------|
| Session 1 | A1 (user action) + A2 | ✅ DONE | A1: `export ANTHROPIC_MODEL=claude-sonnet-4-6` added to ~/.bashrc by Claude |
| Session 2 | B1 + B2 + D1 + D2 + D3 | ⏳ Pending | skill re-injection + model router CLI |
| Session 3 | C1 + C2 | ⏳ Pending | Session Contract + Knowledge Manifest |
| Session 4 | E1-E5 | ⏳ Pending | Quality Benchmark lab tasks |

**A2 (Compact Button Fix):** `system_prompt_addition` → `hookSpecificOutput.additionalContext` (PostToolUse/SessionStart), top-level `additionalContext` (UserPromptSubmit). Resume Message template added to EN+RU compact blocks.

**Critical OpenRouter facts (for D1):**
- Base URL: `https://openrouter.ai/api` (NOT `/api/v1`)
- Auth: `ANTHROPIC_AUTH_TOKEN=sk-or-v1-...` + `ANTHROPIC_API_KEY=""` (explicitly empty)
- Gemini alias: `google/gemini-3-flash-preview`

---

## Current State (2026-04-08)

- **v2.1.0 PUBLISHED** npm@2.1.0 — tagged, pushed to main, publish.yml triggered
- main HEAD: `3d83c7d` (merge commit — feature/token-optimization)
- **593 tests** (536 Jest + 57 Python), 0 failed
- **29 repos updated** via `--update-all` — all `[up to date]`
- **4 GitHub stars**, 0 forks

### v2.1.0 Completed Phases:

| Phase | Status | Summary |
|---|---|---|
| Phase 1 — Context defaults | ✅ Done | `deploySettings()` sets `DISABLE_1M_CONTEXT=1` + `showClearContextOnPlanAccept:true` as one-time defaults |
| Phase 2 — Compact signal | ✅ Done | ExitPlanMode → /compact; one-shot at call 25 (was 40), `SCAFFOLD_COMPACT_THRESHOLD` |
| Phase 3 — Bash output filter | ✅ Done | `bash-output-filter.js` + `filter_rules.json` (10 rules), `{ cmd; } filter \|\| true` syntax |
| Phase 4 — Benchmark harness | ✅ Done | OpenRouter SDK, 25 tasks redesigned, **71.4% savings on Sonnet 4.6** |
| Phase 5 — Agent model routing | ✅ Done | `status-updater.md` agent (haiku frontmatter), opt-in via `SCAFFOLD_LIGHT_AGENTS=true` |
| Hardening — Hook bug fixes | ✅ Done | Braces syntax, pytest PASSED/PASS grep, `\|\| true` fallback, threshold 40→25 |
| Documentation | ✅ Done | README.md + README.ru.md: three pillars, benchmark table, v2.1.0 changelog |
| deploy.py dry-run | ✅ Done | `--dry-run` flag for update/update-all: MD5 diff preview, no writes |

### Benchmark Results (v2.1.0, Sonnet 4.6 via OpenRouter):

| Category | Tasks | Avg Baseline | Avg Optimized | Savings% |
|---|---|---|---|---|
| bash_filter | 10 | ~2 000 tok | ~407 tok | **~78%** |
| skill_activation | 10 | ~2 500 tok | ~700 tok | **~72%** |
| no_filter_expected | 5 | same | same | 0% (expected) |
| **TOTAL** | **25** | **25 084 tok** | **7 178 tok** | **71.4%** |

Model: `claude-sonnet-4-6` via OpenRouter.

---

## Key Architecture

### Hook pipeline (PreToolUse Bash):
1. `session-safety.js` — destructive pattern classification, git snapshot on CRITICAL
2. `bash-output-filter.js` — whitelist wrapping verbose commands: `{ cmd; } 2>&1 | grep | tail || true`

### Skill injection (UserPromptSubmit):
- `skill-activation-prompt.js` reads `filter_rules.json` + `skill-rules.json`
- max 3 skills per session; `python-project-standards` always_load=true
- i18n via `i18n.js` (EN+RU builder functions)

### Compact signal (PostToolUse):
- `session-checkpoint.js` fires once at call 25 (configurable: `SCAFFOLD_COMPACT_THRESHOLD`)
- Also fires on `ExitPlanMode` event

### Deploy:
- `lib/deploy/copy.js` — `deployCore` + `deploySettings`, matcher-based hook merge
- `scripts/deploy.py` — `--update`, `--update-all`, `--dry-run`
- `deployed-repos.json` — local registry (gitignored)

---

## Backlog

- [ ] Submit to `hesreallyhim/awesome-claude-code` via web UI issue form
- [ ] PR to `anthropics/claude-plugins-official` external_plugins/
- [ ] PRs to 4 more awesome-lists (ccplugins, rahulvrane, cassler, VoltAgent)
- [ ] Ping 3 stale PRs (awesome-llm-skills, awesome-claude-plugins, awesome-ai-devtools)
- [ ] Reddit post in r/ClaudeCode
- [ ] Dev.to article — "Claude Code beyond CLAUDE.md"
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] GitHub Actions update: `actions/checkout@v4` → `@v5`, `setup-node@v4` → `@v5` (deadline: June 2026)
- [ ] VHS demo gif re-render via `ssh yc-ctrl` (VHS hangs on Windows due to oh-my-posh)
- [ ] techcon_infra_yac: AWS creds rotation (в git history)

---

## Known Issues

### VHS не работает на Windows
VHS зависает из-за oh-my-posh в .bashrc. Решение: рендерить через `ssh yc-ctrl`.

### Python infra tests UnicodeDecodeError на Windows
`read_text()` использует cp1251 по умолчанию. Фикс: `encoding="utf-8"` везде.

### Compact signal: tool_call_count — слабый proxy для размера контекста
`git status` и `cat large_file.py` — оба 1 вызов, но 10 токен vs 50k. Порог 25 calls — ориентир.

---

## Architecture Decisions (полная история)

| Decision | Choice | Date |
|---|---|---|
| Hook architecture | Pure JS modules (no npm deps) for portability | 2026-03-02 |
| Skill compression | Header extraction + first 50 lines | 2026-03-02 |
| Model routing | Explicit via multimodal-router, no auto-escalation | 2026-03-02 |
| Test strategy | Jest for hooks, Python unittest for infra contracts | 2026-03-02 |
| Priority sort in matchSkills | always_load first, then ascending priority | 2026-03-23 |
| Shared YAML parser | lib/yaml-parser.js — no hook→lib imports | 2026-04-06 |
| Agent extensions | Concatenation at deploy time, idempotency guard | 2026-04-06 |
| Token defaults deploy | `=== undefined` check — one-time, never overwrites user decision | 2026-04-07 |
| Compact signal | Two-trigger: ExitPlanMode + one-shot threshold at call 25 | 2026-04-07 |
| Bash output filter | PreToolUse `updatedInput` whitelist-only + `{ cmd; } || true` + log | 2026-04-08 |
| deploySettings hook merge | Matcher-based dedup — scaffold owns matchers, user hooks preserved | 2026-04-08 |
| i18n coverage | EN+RU builder functions in lib/i18n.js, lazy-loaded in hooks | 2026-04-08 |
| Benchmark SDK | openai SDK → OpenRouter (not anthropic SDK) | 2026-04-08 |
| Benchmark redesign | skill_activation = full injection vs env-only; no_filter_expected = regression check | 2026-04-08 |
| deploy.py dry-run | MD5-based diff preview — shows new/modified files per repo without writing | 2026-04-08 |

---

## Open PRs (публичные репо)

| Repo | PR | Status | Notes |
|---|---|---|---|
| rohitg00/awesome-claude-code-toolkit | #79 | **MERGED** 2026-03-30 | First accepted |
| filipecalegario/awesome-vibe-coding | #100 | **CLOSED** 2026-03-29 | "Need community signals" |
| Prat011/awesome-llm-skills | #56 | open | Ping needed |
| ComposioHQ/awesome-claude-plugins | #66 | open | Ping needed |
| thedaviddias/llms-txt-hub | #787 | open | Vercel auth pending |
| jamesmurdza/awesome-ai-devtools | #326 | open | Ping needed |

---

*Last updated: 2026-04-14 (P0 Session 1+audit done — hook API, Resume Message, PreToolUse fix, pending_notification fix, i18n sync; 29 repos updated to 608b24e)*
