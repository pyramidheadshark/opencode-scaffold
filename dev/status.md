# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

Personal Claude Code infrastructure for ML engineering projects — reusable skills, hooks, agents, and templates that enforce the hexagonal architecture + TDD workflow across all Python/FastAPI projects.

---

## Current Phase

**Active**: v2.1.0 — Token Optimization (2026-04-08)

Branch: `feature/token-optimization`. Phase 1-4 complete, Phase 5 next.
Goal: benchmark-driven token optimization for Claude Code sessions.

---

## Current State (2026-04-08)

- **v1.6.0 PUBLISHED** npm@1.6.0, main HEAD at `a8b4e68`
- **v2.0.0 code complete** on main — publish only by explicit command
- **v2.1.0 IN PROGRESS** on `feature/token-optimization`, HEAD at `dc8ce98`
- **522 tests** (465 Jest + 57 Python), 0 failed
- **4 GitHub stars**, 0 forks

### v2.1.0 Phase Progress:

| Phase | Status | Commit | Summary |
|---|---|---|---|
| Phase 1 — Context defaults | ✅ Done | f1b47db | `deploySettings()` sets `DISABLE_1M_CONTEXT=1` + `showClearContextOnPlanAccept:true` as one-time defaults |
| Phase 2 — Compact signal redesign | ✅ Done | f1b47db | ExitPlanMode → /compact before Step 1; threshold one-shot (default 40), `SCAFFOLD_COMPACT_THRESHOLD` |
| Phase 3 — Bash output filter | ✅ Done | 86fbe65 | `bash-output-filter.js` PreToolUse whitelist, `filter_rules.json`, log to `.claude/logs/filter-log.jsonl` |
| Phase 4 — Benchmark harness | ✅ Done | dc8ce98 | OpenRouter SDK, 25 tasks, 3 PNG graphs, **60.7% savings measured** |
| Phase 5 — Agent model routing | ⏳ Next | — | `status-updater.md` agent with haiku frontmatter, opt-in via `SCAFFOLD_LIGHT_AGENTS=true` |

### Benchmark Results (Phase 4):

| Category | Tasks | Avg Baseline | Avg Optimized | Savings% |
|---|---|---|---|---|
| bash_filter | 10 | 1 900 tok | 407 tok | **78.6%** |
| skill_activation | 10 | 335 tok | 238 tok | **29.0%** |
| edge_case | 5 | 766 tok | 766 tok | 0.0% (ожидаемо) |
| **TOTAL** | **25** | **26 183 tok** | **10 287 tok** | **60.7%** |

Model: `anthropic/claude-haiku-4.5` via OpenRouter. Cost: $0.0613 → $0.0458.

---

## Key Architecture (v2.1.0)

### Новые файлы этой ветки:

| Файл | Что делает |
|---|---|
| `.claude/hooks/bash-output-filter.js` | PreToolUse: whitelist-only wrapping verbose команд (`( cmd ) \| grep \| tail`), fallback на original при ошибке |
| `.claude/hooks/filter_rules.json` | 5 правил: pytest, git log, git diff --stat, npm test, pip install |
| `.claude/hooks/i18n.js` | Deployed копия `lib/i18n.js` — 11 builder functions для всех user-facing блоков (EN+RU) |
| `scripts/benchmark/token_runner.py` | CLI runner: OpenAI SDK → OpenRouter, `--mode baseline\|optimized`, JSONL output с generation_id |
| `scripts/benchmark/tasks.json` | 25 benchmark tasks (10 bash_filter + 10 skill_activation + 5 edge_case) |
| `scripts/benchmark/report.py` | Markdown + 3 PNG embedded (bar chart, category savings, cost pie) → `dev/benchmark-log.md` |
| `scripts/benchmark/check_sdk.py` | Верификация OpenAI SDK + OPENROUTER_API_KEY + тестовый вызов |
| `dev/benchmark-log.md` | Накопительный лог результатов (с embedded PNG через base64) |

### Изменённые файлы:

| Файл | Что изменено |
|---|---|
| `lib/deploy/copy.js` | 1) PreToolUse → 2 hooks (safety + filter); 2) hook merge matcher-based (не path-based) |
| `lib/i18n.js` | +9 builder functions для всех injection blocks (EN+RU), синхронизирован с `.claude/hooks/i18n.js` |
| `.claude/hooks/session-checkpoint.js` | RU-адаптация via i18n; `isDepsTrigger` boolean вместо `includes("BLOCKER")` |
| `.claude/hooks/skill-activation-prompt.js` | RU-адаптация via i18n; все 6 injection blocks через `i18n.buildXxx(lang)` |
| `tests/cli/init.test.js` | PreToolUse 1→2 hooks; matcher-based merge tests; filter_rules.json deploy test |
| `tests/hook/bash-output-filter.test.js` | NEW: 32 теста (8 describe blocks) |

---

## Design Decisions (v2.1.0 specific)

| Decision | Choice |
|---|---|
| Bash filter merge | PreToolUse `updatedInput` — whitelist-only, fallback на original при ошибке |
| hook merge в deploySettings | Matcher-based dedup: scaffold владеет своими matchers, user hooks с другими matcher сохраняются |
| i18n lazy loading | `getI18n()` IIFE + `loadLang(cwd)` — lazy, не падает если i18n.js недоступен |
| isDepsTrigger | Boolean флаг вместо `includes("BLOCKER")` — language-safe |
| Benchmark SDK | OpenAI SDK (openai>=1.0) с `base_url=openrouter.ai/api/v1` — OpenAI-compatible |
| Benchmark observability | `x-session-id` per run, `generation_id` в JSONL, ссылка на дашборд в stdout |
| JSONL в .gitignore | `scripts/benchmark/output/` gitignored — генерируемые артефакты |

---

## Next Session Plan

1. **Phase 5: Agent model routing (opt-in)**
   - Plan mode перед реализацией
   - Создать `.claude/agents/status-updater.md` с frontmatter `model: claude-haiku-4-5-20251001`
   - Изменить `session-start.js`: при `SCAFFOLD_LIGHT_AGENTS=true` inject hint про агента
   - Добавить тесты в `tests/hook/session-start.test.js`
   - Верифицировать frontmatter `model:` field реально подхватывается CC

2. **После Phase 5:**
   - Bump version → 2.1.0 в `package.json`
   - PR `feature/token-optimization` → `main`
   - Update deployed repos через `python scripts/deploy.py --update-all`
   - `dev/benchmark-log.md` → прикрепить к PR как evidence

3. **npm publish v2.1.0** — ТОЛЬКО по явной команде пользователя

---

## Backlog

- [ ] **npm publish v2.0.0** — ONLY by explicit user command: `git tag v2.0.0 && git push origin v2.0.0`
- [ ] **npm publish v2.1.0** — after token-optimization PR merged
- [ ] Submit to `hesreallyhim/awesome-claude-code` via web UI issue form
- [ ] PR to `anthropics/claude-plugins-official` external_plugins/
- [ ] PRs to 4 more awesome-lists (ccplugins, rahulvrane, cassler, VoltAgent)
- [ ] Ping 3 stale PRs (awesome-llm-skills, awesome-claude-plugins, awesome-ai-devtools)
- [ ] Reddit post in r/ClaudeCode
- [ ] Dev.to article — "Claude Code beyond CLAUDE.md"
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] GitHub Actions update: `actions/checkout@v4` → `@v5`, `setup-node@v4` → `@v5` (deadline: June 2026)

---

## Known Issues

### VHS не работает на Windows
VHS зависает из-за oh-my-posh в .bashrc. Решение: рендерить через `ssh yc-ctrl`.

### Python infra tests UnicodeDecodeError на Windows
`read_text()` использует cp1251 по умолчанию. Фикс: `encoding="utf-8"` везде.
Применено также в `check_sdk.py`, `token_runner.py`, `report.py` через stdout wrapper.

### H5 compact signal: tool_call_count — слабый proxy для размера контекста
`git status` и `cat large_file.py` — оба 1 вызов, но 10 токен vs 50k. Порог 40 calls — ориентир.
Для точного сигнала нужен токен-счётчик из API response.

### Bash filter: updatedInput в PreToolUse — нужна верификация в реальной сессии
По CC docs поддерживается. Fallback при любой ошибке — оригинальная команда без изменений.

### Phase 5: frontmatter `model:` в агентах — не верифицировано
Официально документировано в CC docs. Нужно проверить реальное поведение до завершения фазы.

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
| Compact signal | Two-trigger: ExitPlanMode (/compact before Step 1) + one-shot threshold | 2026-04-07 |
| Bash output filter | PreToolUse `updatedInput` whitelist-only + fallback + log | 2026-04-07 |
| deploySettings hook merge | Matcher-based dedup — scaffold owns matchers, user hooks preserved | 2026-04-08 |
| i18n coverage | EN+RU builder functions in lib/i18n.js, lazy-loaded in hooks | 2026-04-08 |
| Benchmark SDK | openai SDK → OpenRouter (not anthropic SDK, not OpenLIT) | 2026-04-08 |
| Benchmark observability | x-session-id per run + generation_id per call → openrouter.ai/activity | 2026-04-08 |
| JSONL output gitignored | scripts/benchmark/output/ — generated artifacts, not committed | 2026-04-08 |

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

*Last updated: 2026-04-08*
