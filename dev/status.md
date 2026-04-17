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

**v2.4.0 — РЕАЛИЗАЦИЯ ЗАВЕРШЕНА, КОММИТ НЕ СДЕЛАН (2026-04-17, Session 8)**

### v2.4.0 — IN PLANNING

Цель: bug fixes + token-aware compact + hook optimizer.

**Архитектурные решения (утверждены):**
- StatusLine хук `session-status-monitor.js` — пишет `context_remaining_pct` + `context_critical` в checkpoint cache; отображает `ctx: X%` в статусбаре
- PostToolUse split: `post-tool-use-tracker` → matcher `Bash|Edit|Write`; `session-checkpoint` → matcher `.*`
- session-checkpoint: убрать 25-message threshold, читать `context_critical` из cache
- i18n.js compact message: убрать "COMPACT REQUIRED BEFORE STEP 1", добавить "Clear context button"
- CLAUDE.md: `MSYS_NO_PATHCONV=1 gh api` rule + SSH alias rule
- Версия: 2.3.1 → **2.4.0** (новый файл + новый тип хука)

**Файлы для реализации:**
1. `.claude/hooks/session-status-monitor.js` — НОВЫЙ
2. `.claude/hooks/session-checkpoint.js` — убрать threshold, добавить context_critical check
3. `.claude/hooks/i18n.js` + `lib/i18n.js` — обновить compact messages (EN+RU синхронно)
4. `lib/deploy/copy.js` — `buildHooksDefinition`: split PostToolUse + add StatusLine
5. `scripts/deploy.py` — `build_hooks_definition`: аналогично
6. `.claude/settings.json` — split PostToolUse matchers + add StatusLine
7. `.claude/CLAUDE.md` — gh MSYS rule + SSH alias rule
8. `tests/hook/session-status-monitor.test.js` — НОВЫЙ, 8 E2E тестов
9. `tests/hook/session-checkpoint.test.js` — +4 теста
10. `tests/infra/test_infra.py` — +2 теста (StatusLine present + split matchers)
11. `package.json` — 2.3.1 → 2.4.0

**Тесты:** +14 → цель 568 Jest + 63 Python
**Commits:** 2 (feat + docs)
**Деплой:** python scripts/deploy.py --update-all после коммита

**План:** `C:\Users\pyramidheadshark\.claude\plans\wobbly-wishing-meerkat.md`

### v2.3.1 — DONE (2026-04-15, Session 7)

- npm@2.3.1 published, HEAD `5f94abc`
- 554 Jest + 61 Python тестов, 0 failed
- Thinking Defaults: `EFFORT=max`, `DISABLE_ADAPTIVE_THINKING=1`, `showThinkingSummaries=true`
- 30 репо (29 registered + claude-scaffold сам) — tune applied, все ключи активны
- `scripts/deploy.py` хотфикс: `apply_tuning_defaults` теперь пишет env-ключи (был исторический gap Python-пути)
- `claude-scaffold tune` команда — оверрайт настроек в пост-деплой (без re-init)
- README 522→345 строк, docs/REFERENCE + docs/CHANGELOG обновлены

**Decisions:**
- Канонический env var: `CLAUDE_CODE_EFFORT_LEVEL` (не `CLAUDE_REASONING_EFFORT`; `effortLevel` в settings.json broken per GH #35904)
- Deploy: non-overwrite (мирроринг существующего `CLAUDE_CODE_DISABLE_1M_CONTEXT`); `tune`: overwrite
- Флаг `off` на deploy = пропустить запись ключа (не писать blank)
- Attribution: "Anthropic / Claude Code team" (HN thread, Boris)

---

**Session 6 — DONE (2026-04-14). v2.2.1 опубликован, 29 репо обновлены.**

Сессия выполнена полностью, осталось два деплой-действия:

1. ⏳ `git tag v2.2.0 && git push origin v2.2.0` → CI публикует npm@2.2.0 автоматически
2. ⏳ `npx claude-scaffold update --all` → обновить 29 репо до HEAD `bade556`

**Что делается в Session 6:**

| Задача | Статус | Детали |
|--------|--------|--------|
| session-safety.js block logging | ✅ | appendSessionEvent при block + snapshot_created |
| post-tool-use-tracker.js bash + count | ✅ | bash_command JSONL + tool_call_count в session cache |
| +4 новых теста | ✅ | 2 в session-safety + 2 в post-tool-use-tracker |
| README.md v2.2.0 features | ✅ | badges, счётчик, Session Management раздел |
| README.ru.md v2.2.0 features | ✅ | то же на RU |
| package.json 2.2.0→2.2.1 | ✅ | |
| MEMORY.md актуализация | ✅ | версия, тесты, Key Paths, без стейла |
| analyze_logs.py удалён | ✅ | временный скрипт |
| git commit 1 (logging) | ✅ | `160157e` |
| git commit 2 (docs) | ✅ | `589b9a6` |
| git tag v2.2.1 + push | ✅ | npm@2.2.1 published |
| python scripts/deploy.py --update-all | ✅ | 29/29 up to date |

**Что было сделано в Session 5:**

| Задача | Статус | Коммит / Детали |
|--------|--------|-----------------|
| GH Actions v5 | ✅ | `checkout@v4→v5`, `setup-node@v4→v5` в ci.yml + publish.yml |
| WEIGHTS тесты удалены | ✅ | 4 вакуозных константных теста из session-utils.test.js |
| Skill Discovery CLI | ✅ | `lib/commands/discover.js`: detectStack (16 детекторов), searchRegistry, runDiscover |
| `claude-scaffold discover` команда | ✅ | `bin/cli.js` +discover; опции --install, --json |
| session-start.js триггер | ✅ | `buildDiscoverySuggestionBlock`: session=1 + skills<4 → инжект подсказки |
| 17 новых тестов | ✅ | 12 в `tests/cli/discover.test.js` + 5 в `tests/hook/session-start.test.js` |
| package.json 2.1.0→2.2.0 | ✅ | |
| Push в main | ✅ | HEAD `bade556` |

---

## Roadmap Sessions (История)

| Сессия | Фазы | Статус | HEAD |
|--------|------|--------|------|
| **Session 1** (2026-04-14) | A1 billing guard + A2 hook API migration + Audit | ✅ DONE | `352798a` |
| **Session 2** (2026-04-14) | B1 size test + B2 Haiku frontmatter + D1-D3 model router | ✅ DONE | (after S1) |
| **Session 3** (2026-04-14) | C1 Session Contract + E1/E3/E5 Quality Benchmark | ✅ DONE | `7689210` |
| **Session 5** (2026-04-14) | GH Actions v5 + Test cleanup + Skill Discovery + v2.2.0 bump | ✅ DONE | `bade556` |

### Session 1 — детали

| Задача | Что сделано | Файлы |
|--------|-------------|-------|
| **A1** | `export ANTHROPIC_MODEL=claude-sonnet-4-6` → `~/.bashrc` | `~/.bashrc` |
| **A2** | Hook API: `system_prompt_addition` → `hookSpecificOutput.additionalContext` | 3 хука |
| **A2+** | Post-Compact Resume Message: 3-step шаблон EN+RU | `lib/i18n.js`, `hooks/i18n.js` |
| **CRITICAL FIX** | `deploy.py` не включал `PreToolUse` → bash-output-filter и session-safety не работали | `scripts/deploy.py` |
| **BUG FIX** | `pending_notification` stale-cache: spread → mutate in-place | `skill-activation-prompt.js` |
| **29 repos** | Обновлены до `352798a` со всеми фиксами | `deployed-repos.json` |

### Session 2 — детали

| Задача | Что сделано | Файлы |
|--------|-------------|-------|
| **D1-D3** | `claude-scaffold use <model>` / `install-aliases`; 5 профилей + 3 пресета; .sh + .ps1 | `lib/commands/model-router.js`, `bin/cli.js` |
| **B2** | `model:` frontmatter в 8 агентских файлах | `.claude/agents/*.md` |
| **B1-size** | E2E тест: 5 промптов подряд, max injection 2-5 < 60% от первого | `tests/hook/skill-activation-e2e.test.js` |

### Session 3 — детали

| Задача | Что сделано | Файлы |
|--------|-------------|-------|
| **C1** | Session Contract template + `claude-scaffold new-session` + session-start.js buildContractMissingBlock | `templates/session-contract.md`, `lib/commands/new-session.js`, `session-start.js` |
| **E1/E3/E5** | Quality benchmark runner + lab fixtures (fibonacci, vulnerable_api, yaml_parser_spec) + 21 тест-кейс скорер | `scripts/benchmark/quality_runner.py`, `scripts/benchmark/lab/`, `tests/benchmark/` |

---

## Current State (2026-04-14)

- **v2.2.1 PUBLISHED** npm@2.2.1 (2026-04-14), HEAD = `589b9a6`
- **main HEAD: `589b9a6`**
- **593 tests** (534 Jest + 59 Python infra), 0 failed
- **29 repos** на `589b9a6` — все up to date
- `ANTHROPIC_MODEL=claude-sonnet-4-6` в `~/.bashrc` — billing guard активен
- `claude-scaffold use <model>` — Model Router CLI активен
- `claude-scaffold discover` — Skill Discovery активен (CLI + session-start хук)
- **session-safety.js**: block events + snapshot_created теперь пишутся в JSONL
- **post-tool-use-tracker.js**: Bash tracking + tool_call_count исправлен (больше не null)

### npm publish path:
```bash
git tag v2.2.0 && git push origin v2.2.0
# → publish.yml запускается автоматически → npm@2.2.0
# НЕ используй npm publish (требует 2FA hardware key)
```

### Что деплоится в target репо:

| Хук | Тип | Что делает |
|-----|-----|------------|
| `session-safety.js` | PreToolUse (Bash) | Деструктивные команды → block + git snapshot |
| `bash-output-filter.js` | PreToolUse (Bash) | Verbose команды → whitelist фильтрация |
| `session-start.js` | SessionStart | Platform detect + onboarding + Windows rules + Contract check + Discovery hint |
| `skill-activation-prompt.js` | UserPromptSubmit | Skill injection + status hash dedup |
| `session-checkpoint.js` | PostToolUse | ExitPlanMode → Resume Message; one-shot threshold 25 |
| `post-tool-use-tracker.js` | PostToolUse | Weight accumulation + JSONL audit |
| `python-quality-check.js` | Stop | End-of-session quality check |

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

### Skill Discovery — архитектура (Session 5):
- `lib/commands/discover.js` — читает `registry/skills.json` напрямую (не через кэш/HTTP)
- `detectStack(cwd)` — 16 детекторов: React/Vue/Next/Express/TS/FastAPI/PyTorch/sklearn/LangChain/Anthropic SDK/Rust/Go/Terraform/Flutter/Python/Node
- `searchRegistry(infraDir, tags)` — фильтр по tag intersection, сортировка по matchCount desc
- `buildDiscoverySuggestionBlock(fsModule, cwd, sessionCount)` — инжект только session=1 И skill-rules.json < 4 rules

### Deploy:
- `lib/deploy/copy.js` — `deployCore` + `deploySettings`, matcher-based hook merge, 5 hook types
- `scripts/deploy.py` — `--update`, `--update-all`, `--dry-run`; SHA-based skip
- `deployed-repos.json` — local registry (gitignored)

---

## Backlog (приоритизировано)

### Техдолг (не сделано в Session 5)
- [ ] **deploy.py тесты** — самый опасный непокрытый файл. Python unittest: `--all` флаг, PreToolUse в settings.json, не перезаписывает status.md
- [ ] **Интеграционный тест** `new-session` → `session-start` → напоминание исчезает (сейчас только unit)

### v2.3.0 features
- [ ] Session Contract архивация: `dev/active/` → `dev/archive/YYYY-MM/` после завершения
- [ ] `claude-scaffold status` показывает contract state + last benchmark date
- [ ] Quality benchmark интеграция в report.py (сейчас JSONL от quality_runner не читается bench:report)
- [ ] Запустить реальный benchmark haiku vs sonnet (нужен OPENROUTER_API_KEY)
- [ ] Новые скилы для registry: react-patterns, typescript-patterns, rust-patterns (чтобы `discover` давал результат для фронтенд/системных проектов)

### Маркетинг / growth
- [ ] Submit to `hesreallyhim/awesome-claude-code` via web UI issue form
- [ ] PRs to 4 awesome-lists: ccplugins, rahulvrane, cassler, VoltAgent
- [ ] Ping 3 stale PRs: awesome-llm-skills (#56), awesome-claude-plugins (#66), awesome-ai-devtools (#326)
- [ ] Reddit post in r/ClaudeCode
- [ ] Dev.to article — "Claude Code beyond CLAUDE.md"

### Инфра / Репо
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] techcon_infra_yac: AWS creds rotation (в git history)
- [ ] VHS demo gif re-render via `ssh yc-ctrl`

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
| Skill Discovery layers | discover.js → registry/skills.json direct (no cache); runRegistrySearch → cache+HTTP. Different layers, no duplication. | 2026-04-14 |
| buildDiscoverySuggestionBlock | session=1 AND skill-rules.json < 4 rules — двойной guard против ложных триггеров | 2026-04-14 |

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

*Last updated: 2026-04-14 (Session 5 done — GH Actions v5 + Skill Discovery; v2.2.0 ready to tag)*
