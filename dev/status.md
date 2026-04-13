# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

**v3.0 vision:** *Adapting Claude Code to modern Anthropic constraints + production infrastructure*

Не просто скаффолдинг — полноценная инфраструктура для работы с Claude Code в условиях реальных ограничений: контекст, биллинг, multi-model routing, production-grade session protocol.

Три старых столпа: **scaffolding** (deploy + sync), **token optimization** (71.4% savings), **multi-repo management** (update --all).

Три новых столпа (v3.0): **model routing** (OpenRouter gateway, Gemini/Haiku/Opus by task), **session protocol** (Contract + Knowledge Manifest), **quality benchmarks** (lab tasks, model comparison).

---

## Current Phase

**P0 Overhaul — Session 1 + Audit COMPLETE. Session 2 ready.**

---

## Roadmap → v3.0

Full plan: `C:\Users\pyramidheadshark\.claude\plans\functional-squishing-hinton.md`

| Сессия | Фазы | Статус | HEAD |
|--------|------|--------|------|
| **Session 1** | A1 (billing guard) + A2 (hook API migration) + Audit | ✅ DONE | `352798a` |
| **Session 2** | B1 (audit) + B2 (Haiku) + D1-D3 (model router) + quick wins | ⏳ **NEXT** | — |
| **Session 3** | C1 (Session Contract) + C2 (Knowledge Manifest) + E-tasks → **v3.0 tag** | ⏳ Pending | — |

### Session 1 — выполнено (2026-04-14)

| Задача | Что сделано | Файлы |
|--------|-------------|-------|
| **A1** | `export ANTHROPIC_MODEL=claude-sonnet-4-6` → `~/.bashrc` | `~/.bashrc` |
| **A2** | Hook API: `system_prompt_addition` → `hookSpecificOutput.additionalContext` (PostToolUse/SessionStart); top-level `additionalContext` (UserPromptSubmit) | 3 хука |
| **A2+** | Post-Compact Resume Message: 3-step шаблон EN+RU | `lib/i18n.js`, `hooks/i18n.js` |
| **CRITICAL** | `deploy.py` не включал `PreToolUse` → `bash-output-filter` и `session-safety` не активировались в 29 репо | `scripts/deploy.py` |
| **BUG** | `pending_notification` stale-cache: spread → mutate in-place | `skill-activation-prompt.js` |
| **SYNC** | `lib/i18n.js` ↔ `.claude/hooks/i18n.js` синхронизированы | оба файла |
| **TESTS** | Очищены вакуозные тесты; infra тест проверяет PreToolUse | 5 тест-файлов |
| **29 repos** | Обновлены до `352798a` со всеми фиксами | `deployed-repos.json` |

---

## Current State (2026-04-14)

- **v2.1.0 PUBLISHED** npm@2.1.0 (2026-04-08)
- **main HEAD: `352798a`** (P0 Session 1 + Audit)
- **535 tests** (478 Jest + 57 Python), 0 failed
- **29 repos** обновлены до `352798a` с PreToolUse — все `[up to date]`
- **4 GitHub stars**, 0 forks
- `ANTHROPIC_MODEL=claude-sonnet-4-6` в `~/.bashrc` — billing guard активен

### Что работает сейчас в целевых репо (после Session 1):

| Хук | Тип | Что делает | Статус |
|-----|-----|------------|--------|
| `session-safety.js` | PreToolUse (Bash) | Деструктивные команды → block + git snapshot | ✅ Активен |
| `bash-output-filter.js` | PreToolUse (Bash) | Verbose команды → whitelist фильтрация | ✅ Активен (впервые!) |
| `session-start.js` | SessionStart | Platform detect + onboarding + Windows rules | ✅ |
| `skill-activation-prompt.js` | UserPromptSubmit | Skill injection + status hash dedup | ✅ |
| `session-checkpoint.js` | PostToolUse | ExitPlanMode → Resume Message; one-shot threshold 25 | ✅ |
| `post-tool-use-tracker.js` | PostToolUse | Weight accumulation + JSONL audit | ✅ |
| `python-quality-check.js` | Stop | End-of-session quality check | ✅ |

---

## Session 2 — Scope (⏳ Pending)

**B1: Skill re-injection audit**
- Что уже есть: `alreadyLoaded` guard (L53), status hash dedup (L139-144) — ОБА реализованы
- Что добавить: E2E тест на измерение injection size (5 prompts → size metrics)
- Время: ~20 мин

**B2: Haiku для subagents**
- Добавить `recommended_model` frontmatter в `.claude/agents/*.md`
- Обновить Agent Inventory в `CLAUDE.md` с колонкой модели
- Время: ~30 мин

**D1-D3: Model Router CLI** ← main feature Session 2
- Новый файл: `lib/commands/model-router.js`
- Команды: `claude-scaffold use <model>`, `claude-scaffold install-aliases`, `claude-scaffold status` (расширить)
- Профили: sonnet, haiku, opus (Anthropic), gemini-flash, gemini-pro (OpenRouter)
- Пресеты: `executor`→gemini-flash, `architect`→opus, `critic`→sonnet
- Время: ~120 мин

**Quick win: status.md в session-start.js**
- Загружать `dev/status.md` также при старте сессии (не только при UserPromptSubmit)
- 8 строк кода, тест 3 строки
- Время: ~15 мин

**Целевой объём Session 2:** 2 коммита, ~3ч работы

---

## Critical OpenRouter Facts (для D1)

```bash
ANTHROPIC_BASE_URL="https://openrouter.ai/api"   # НЕ /api/v1
ANTHROPIC_AUTH_TOKEN="sk-or-v1-..."              # НЕ ANTHROPIC_API_KEY
ANTHROPIC_API_KEY=""                              # явно пустой
```

Gemini alias: `google/gemini-3-flash-preview` (experimental — `"experimental": true` в config + warning)

---

## Key Architecture

### Hook pipeline:
```
PreToolUse (Bash):    session-safety.js → bash-output-filter.js
SessionStart:         session-start.js
UserPromptSubmit:     skill-activation-prompt.js → skill-activation-logic.js
PostToolUse (.*):     post-tool-use-tracker.js → session-checkpoint.js
Stop:                 python-quality-check.js
```

### Hook output formats (CRITICAL — не регрессировать):
```javascript
// PostToolUse / SessionStart:
{ continue: true, hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "..." } }
// UserPromptSubmit:
{ continue: true, additionalContext: "..." }
// PreToolUse — session-safety:
{ action: "block" | "continue" }
// PreToolUse — bash-output-filter:
{ action: "continue", updatedInput: { command: wrappedCommand } }
```

### Deploy:
- `lib/deploy/copy.js` — `deployCore` + `deploySettings`, matcher-based hook merge, 5 hook types
- `scripts/deploy.py` — `--update`, `--update-all`, `--dry-run`; SHA-based skip (must commit before update-all)
- `deployed-repos.json` — local registry (gitignored)

---

## Backlog (не в текущем roadmap)

- [ ] Submit to `hesreallyhim/awesome-claude-code` via web UI issue form
- [ ] PRs to 4 more awesome-lists (ccplugins, rahulvrane, cassler, VoltAgent)
- [ ] Ping 3 stale PRs (awesome-llm-skills, awesome-claude-plugins, awesome-ai-devtools)
- [ ] Reddit post in r/ClaudeCode
- [ ] Dev.to article — "Claude Code beyond CLAUDE.md"
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] GitHub Actions update: `actions/checkout@v4` → `@v5`, `setup-node@v4` → `@v5` (deadline: June 2026)
- [ ] VHS demo gif re-render via `ssh yc-ctrl`
- [ ] techcon_infra_yac: AWS creds rotation (в git history)

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
| Bash output filter | PreToolUse `updatedInput` whitelist-only + `{ cmd; } \|\| true` + log | 2026-04-08 |
| deploySettings hook merge | Matcher-based dedup — scaffold owns matchers, user hooks preserved | 2026-04-08 |
| i18n coverage | EN+RU builder functions in lib/i18n.js, lazy-loaded in hooks | 2026-04-08 |
| Benchmark SDK | openai SDK → OpenRouter (not anthropic SDK) | 2026-04-08 |
| Hook output API | system_prompt_addition deprecated → hookSpecificOutput.additionalContext / additionalContext | 2026-04-14 |
| Post-Compact Resume | 3-step: Generate message → Tell user /compact → WAIT | 2026-04-14 |
| PreToolUse in deploy.py | session-safety + bash-output-filter always deployed via Python path | 2026-04-14 |
| pending_notification clear | Mutate cache in-place (not spread) to avoid stale read | 2026-04-14 |

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

*Last updated: 2026-04-14 (Session 1 + Audit complete; Session 2 scope defined; v3.0 vision set)*
