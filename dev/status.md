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

**v2.7.1 — READY TO PUBLISH (2026-04-21)**

### v2.7.1 Scope

Два добавления к v2.7.0 (обе ветки основаны на пользовательском фидбеке по ходу сессии):

1. **Runtime model indicator (⚡ override marker)** — statusline теперь читает `input.model` из stdin StatusLine hook'а. Если `/model <id>` слэш-команда перекрыла модель из `settings.json` — показывается маркер `⚡` (emoji) / `(!)` (plain). Решает проблему "я переключился на opus через /model, а статусбар показывает sonnet". Backward compat: без runtime id фолбэчит на `settings.model`.

2. **Default профиль → haiku для balanced** — `PROFILE_MATRIX[balanced]`: `default: sonnet → haiku`, `no-sonnet: haiku → opus`. Причина: пользователь хочет экономить Sonnet-квоту на power-репо. Сохранено различение профилей: balanced теперь отличается от standard в `no-sonnet` режиме (opus vs haiku).

**Итоговая матрица v2.7.1**:

| Profile  | default     | economy  | no-sonnet |
|----------|-------------|----------|-----------|
| power    | Sonnet 4.6  | Haiku 4.5 | Opus 4.7  |
| standard | Haiku 4.5   | Haiku 4.5 | Haiku 4.5 |
| balanced | Haiku 4.5   | Haiku 4.5 | Opus 4.7  |

**Applied to**: 4 power репо (techcon_hub, rgs_hub, claude-scaffold, dumpster) остаются на Sonnet в default; все остальные 26 репо — Haiku по умолчанию.

### Post-v2.7.1 Checklist

- [ ] `git push origin main` — пушит 8b50a0f + 36c2fda (v2.7.0) + новые 2 коммита v2.7.1
- [ ] `git tag v2.7.1 && git push --tags`
- [ ] `npm publish` (scope: public)
- [ ] `node bin/cli.js mode default` — пропагирует haiku в 26 не-power репо (перезапишет их settings.json)

### Resume Note — v2.7.0 Implementation Progress

**Decision**: Opus effort=`medium` (not `high` per plan) — per user feedback during session.

**Completed**:
- Step 1 (opus ID migration claude-opus-4-6 → claude-opus-4-7): DONE
  - lib/models.js (MODEL_IDS + MODEL_LABELS→'Opus 4.7')
  - lib/commands/model-router.js
  - scripts/deploy.py MODEL_IDS
  - .claude/agents/design-doc-architect.md frontmatter
  - .claude/hooks/session-status-monitor.js MODEL_MAP
  - .claude/hooks/mode-detector.js (2 places)
  - .claude/hooks/session-start.js (2 places Opus 4.7 label)
  - .claude/commands/mode-switch.md (ID + label)
  - .claude/CLAUDE.md Agent Inventory
  - .claude/skills/claude-api-patterns/SKILL.md
  - README.md, README.ru.md (Opus 4.7 label)
  - Tests updated: mode-detector, session-status-monitor, mode, models, session-start, test_infra
- Step 2 (quota.js): DONE
  - Bug fix: `['--json']` → `['daily', '--json']`
  - tryNpx default true (`opts.tryNpx !== false`)
  - Added BLOCK_CACHE_PATH, BLOCK_CACHE_TTL_MS (2 min)
  - Added loadBlockCache / saveBlockCache / getBlockStatus (parses ccusage blocks --active, computes usedPct)
  - refresh subcmd now calls getBlockStatus({skipCache:true})
  - Exports updated
- Step 3 (session-status-monitor.js new format): DONE
  - Added readWeeklyCost, readBlockStatus, formatBlock, formatWeeklyCost
  - main() pipeline: context + model + block + cost
  - Backward compat: kept formatQuota, readQuotaCache exports
  - Format: `Context: ⚠ 45% │ 🟣 Opus 4.7 │ 5h: 97% ⏱9m │ $36.9`
  - Plain fallback: `Context: ! 45% | ops | 5h: 97% 9m | $36.9`
- Step 4a (lib/deploy/copy.js): DONE
  - Added effortDefaultForProfile() — opus→medium, else→max
  - applyTuningDefaults(existing, tuning, modelProfile) — opus gets medium
  - deploySettings passes modelProfile

**Remaining**:
- Step 4b — scripts/deploy.py apply_tuning_defaults(existing, model_profile=None) mirror for Python
- Step 4c — lib/commands/mode.js writeSettingsModel: currently hardcodes `'max'` for non-haiku; change to opus→'medium', sonnet→'max'
- Step 5 — mode-detector.js patterns:
  - Extend no-sonnet regex: add `/смени.*(?:сессию.*)?(?:на|в)\s*опус|switch.*(?:session.*)?to\s*opus/i`
  - Add TRANSIENT_PATTERNS: `/(?:смени|переключи).*текущ[а-я]+\s+сессию\s+на/i`, `/switch.*current\s+session\s+to/i`
  - Fix: `/делаем задачу в (экономн[оа-я]+|no-?sonnet|default)(?: режим)?/i` — режим optional
- Step 6 — Tests:
  - tests/cli/quota.test.js — add getBlockStatus tests; update mock args 'daily --json'; test saveBlockCache
  - tests/hook/session-status-monitor.test.js — add formatBlock / formatWeeklyCost tests; E2E expected output update
  - tests/hook/mode-detector.test.js — 3 new pattern tests (smeni na opus, "делаем в no-sonnet" → transient)
  - tests/cli/mode.test.js — 'keeps CLAUDE_CODE_EFFORT_LEVEL=max for opus' test needs update to 'medium' (line 68-74)
  - tests/infra/test_infra.py — test deploy with model_profile='opus' → effort='medium' (line 497 currently asserts 'max' for sonnet which is fine)
- Step 7 — package.json bump 2.6.1 → 2.7.0
- Step 8 — npm test verification

**Key files edited so far** (no commits yet):
lib/models.js, lib/commands/model-router.js, lib/commands/quota.js, lib/deploy/copy.js,
.claude/hooks/session-status-monitor.js, .claude/hooks/mode-detector.js, .claude/hooks/session-start.js,
.claude/agents/design-doc-architect.md, .claude/commands/mode-switch.md, .claude/CLAUDE.md,
.claude/skills/claude-api-patterns/SKILL.md, scripts/deploy.py (MODEL_IDS only — apply_tuning_defaults not yet),
README.md, README.ru.md, tests/hook/{mode-detector,session-status-monitor,session-start}.test.js,
tests/cli/{mode,models}.test.js, tests/infra/test_infra.py

**Commit plan** (3 commits at the end):
1. `fix: update opus model ID to claude-opus-4-7 across codebase`
2. `feat: 5h block + weekly cost in statusline, fix ccusage args (v2.7.0)`
3. `feat: model-aware effort defaults and mode-detector opus patterns (v2.7.0)`

---

**v2.6.1 — PUBLISHED (2026-04-21, Session 10 continued)**

### Итог v2.6.1

- **npm@2.6.1 published** ✅ — publish.yml: `success`
- **HEAD: `3f44807`** (main, tag v2.6.1)
- **783 теста** (715 Jest + 68 Python), 0 failed
- **30 репо** на v2.6.1 через `python scripts/deploy.py --update-all`

**Что переделано относительно v2.6.0:**

| Фаза | Суть |
|------|------|
| Modes renamed | `lean → economy`, `quota-save → no-sonnet`. Старые имена — с deprecation warning. |
| Roles → base_profiles | `hub/worker/default` → `power/standard/balanced`. Миграция на лету. |
| Auto-detect by repo name | `techcon_hub/rgs_hub/claude-scaffold/dumpster`→power; `techcon_*` (non-hub)→standard; `rgs_*` и без префикса → balanced |
| Profile × mode matrix | power: sonnet/haiku/opus; standard: haiku/haiku/haiku; balanced: sonnet/haiku/haiku |
| ccusage optional dep | `package.json.optionalDependencies.ccusage ^18.0.11`. `lib/commands/quota.js` парсит `--json` output, weekly из daily aggregation |
| Quota warnings | SessionStart инжектит `[QUOTA WARNING]` при >80% и `[QUOTA ALMOST EXHAUSTED]` при >95% |
| Statusline redesign | `Context: ⚠ 18% │ 🔵 Sonnet 4.6 │ 🟢 Week: 45%` с эмодзи 🔵/🟣/🟢 и 🟢/🟡/🔴 для квоты. `SCAFFOLD_STATUSLINE_PLAIN=1` → ASCII fallback |
| Natural-language mode switch | `.claude/hooks/mode-detector.js` — regex детектор на RU+EN фразы. `skill-activation-prompt.js` инжектит инструкцию для Claude |
| Hub mode routing guide | SessionStart инжектит `[MODE ROUTING GUIDE]` только в repos с base_profile=power — даёт агенту таблицу режимов + инструкцию проактивно предлагать смену |
| Slash `/mode-switch` | Fallback slash command в `.claude/commands/mode-switch.md` |

**UX переключения (критически важное решение):**

| Сценарий | Что делает Claude |
|----------|-------------------|
| «Переходим в экономный режим» | detectMode → persistent — Bash `claude-scaffold mode economy` + «перезапусти сессию» |
| «Делаем задачу в экономном режиме» | detectMode → transient — Claude Code `/model claude-haiku-4-5-20251001` |
| `/mode-switch economy` | Slash-команда как fallback если детектор промахнулся |

**Базовые профили 30 репо:**
- 4 power: techcon_hub, rgs_hub, claude-scaffold, dumpster
- 10 standard: все techcon_* кроме hub
- 16 balanced: rgs_* + без префикса

---

**v2.6.0 — DONE (2026-04-21, Session 10)**

### Итог сессии

- **package.json: 2.5.0 → 2.6.0** ✅
- **HEAD: `925345a`** (main, не тегнуто — публикация только по команде пользователя)
- **674 теста** (606 Jest + 68 Python), 0 failed
- **30 репо** задеплоены через `python scripts/deploy.py --update-all`, все `model: claude-sonnet-4-6` в settings.json
- `active_mode: default` в registry; `techcon_hub` помечен как `role: hub`

**Что реализовано (3 коммита):**

| # | Коммит | Суть |
|---|--------|------|
| 1 | `feat: add per-repo model routing to deploy pipeline (v2.6.0)` | `lib/models.js` (MODEL_IDS + MODES + resolveProfileForRole), `deploySettings(targetDir, tuning, modelProfile)` с haiku effort-cleanup, `registerDeploy` принимает model/role, `deploy.py --model --role` флаги |
| 2 | `feat: add mode command for mass model switching (v2.6.0)` | `lib/commands/mode.js` (applyMode/setRole/showStatus/writeSettingsModel), `bin/cli.js mode` subcommand, 20 тестов |
| 3 | `feat: model conflict detection and statusline indicator (v2.6.0)` | `session-start.js` + `loadSettings` + model conflict warning (EN+RU), `session-status-monitor.js` показывает `ctx: 55% \| son/hai/ops`, `lib/i18n.js` + `.claude/hooks/i18n.js` — `buildModelConflictBlock`, package.json 2.5.0→2.6.0 |

**Команды:**
```bash
claude-scaffold mode                        # = mode status
claude-scaffold mode status                 # таблица: repo | role | model
claude-scaffold mode default                # все → sonnet
claude-scaffold mode quota-save             # hub→opus, worker/default→haiku
claude-scaffold mode lean                   # все → haiku
claude-scaffold mode set-role hub <path>    # пометить репо как hub
python scripts/deploy.py --update <path> --model haiku  # per-repo overwrite
```

**E2E verification:**
- `mode set-role hub techcon_hub` → role = hub ✅
- `mode quota-save` → techcon_hub=opus+effort, techcon_defectoscopy=haiku (без effort) ✅
- `mode default` → все sonnet ✅
- Statusline: `ctx: 55% | son` ✅
- `--update-all` (30 repos) → все on `925345a`, all `model: claude-sonnet-4-6` ✅

---

**v2.5.0 — DONE (2026-04-21, Session 9)**

### Итог сессии

- **npm@2.5.0 published** ✅ — publish.yml: `completed success`
- **HEAD: `dafd596`** (main, tag v2.5.0)
- **630 тестов** (568 Jest + 62 Python), 0 failed
- **30 репо** задеплоены через `python scripts/deploy.py --update-all`

**Что исправлено:**

| Баг | Файл | Суть |
|-----|------|------|
| A | `session-safety.js:96` | `sanitizeSessionId()` хэшировал UUID→MD5, кэш писался не туда |
| B | `python-quality-check.js` | `session_end` не писался для JS/infra репо (guard срабатывал раньше) |
| C | `session-status-monitor.js` | threshold 20→30; round перед сравнением |
| F | `.claude/settings.json` | scaffold теперь имеет PreToolUse хуки + showClearContextOnPlanAccept |

---

**v2.4.0 — ПОЛНОСТЬЮ ЗАВЕРШЕНО (2026-04-17, Session 8)**

- **npm@2.4.0 published** ✅ — publish.yml: `completed success`
- **HEAD: `e70f1af`** (main, все CI зелёные)
- **625 тестов** (563 Jest + 62 Python), 0 failed
- **30 репо** задеплоены через `python scripts/deploy.py --update-all`
- **README.md + README.ru.md + CHANGELOG.md** — актуализированы под v2.4.0

**Что реализовано:**

| Компонент | Суть |
|-----------|------|
| `session-status-monitor.js` | НОВЫЙ StatusLine хук: `ctx: ⚠ X%` в статусбаре, пишет `context_critical` в cache |
| PostToolUse split | tracker → `Bash\|Edit\|Write`; checkpoint → `.*`. Фикс uv_spawn EUNKNOWN |
| `session-checkpoint.js` | Убран threshold 25; compact по `context_critical: true` из cache |
| i18n EN+RU | Убрано "COMPACT REQUIRED BEFORE STEP 1"; добавлена "Clear context button" |
| `settings.json` | `statusLine` как top-level ключ (не внутри hooks — важно!) |
| `CLAUDE.md` | Правила: MSYS_NO_PATHCONV=1 gh api + SSH alias вместо raw IP |
| Docs | README badge/hooks/counts, CHANGELOG v2.4.0, README.ru.md раздел compact |

**Критический аналитик (проведён в Session 8):**
- Все 11 scope-пунктов v2.4.0 подтверждены как корректно реализованные
- Единственная находка — ложное срабатывание на `DEFAULT_THRESHOLD` в мониторе (порог там и должен быть)

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

## Current State (2026-04-17)

- **v2.4.0 PUBLISHED** npm@2.4.0 (2026-04-17), HEAD = `e70f1af`
- **main HEAD: `e70f1af`**
- **625 tests** (563 Jest + 62 Python infra), 0 failed
- **30 repos** на `0042d55` (v2.4.0 impl hooks + statusLine) — все up to date. Docs-only коммиты после деплоя re-deploy не требуют.
- `ANTHROPIC_MODEL=claude-sonnet-4-6` в `~/.bashrc` — billing guard активен
- StatusLine хук активен во всех 30 репо — контекст отображается в статусбаре
- PostToolUse split активен — нет лишних spawn на Read/Glob/Grep

### npm publish path:
```bash
git tag vX.Y.Z && git push origin vX.Y.Z
# → publish.yml запускается автоматически
# НЕ используй npm publish (требует 2FA hardware key)
```

### Что деплоится в target репо:

| Хук | Тип | Что делает |
|-----|-----|------------|
| `session-safety.js` | PreToolUse (Bash) | Деструктивные команды → block + git snapshot |
| `bash-output-filter.js` | PreToolUse (Bash) | Verbose команды → whitelist фильтрация |
| `session-start.js` | SessionStart | Platform detect + onboarding + Windows rules + Contract check + Discovery hint |
| `skill-activation-prompt.js` | UserPromptSubmit | Skill injection + status hash dedup |
| `post-tool-use-tracker.js` | PostToolUse (Bash\|Edit\|Write) | Weight accumulation + JSONL audit |
| `session-checkpoint.js` | PostToolUse (.*) | ExitPlanMode → Resume Message; context_critical → compact signal |
| `session-status-monitor.js` | StatusLine | Отображает `ctx: X%` в статусбаре, пишет context_critical в cache |
| `python-quality-check.js` | Stop | End-of-session quality check |

---

## Key Architecture

### Hook pipeline:
```
PreToolUse (Bash):           session-safety.js → bash-output-filter.js
SessionStart:                session-start.js
UserPromptSubmit:            skill-activation-prompt.js → skill-activation-logic.js
PostToolUse (Bash|Edit|Write): post-tool-use-tracker.js
PostToolUse (.*):            session-checkpoint.js
StatusLine:                  session-status-monitor.js  [top-level key in settings.json]
Stop:                        python-quality-check.js
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
| StatusLine config location | `statusLine` is a top-level key in settings.json, NOT inside `hooks` — schema validation rejects StatusLine as a hook event | 2026-04-17 |
| PostToolUse split (v2.4.0) | tracker → `Bash\|Edit\|Write` (fixes uv_spawn EUNKNOWN on Windows); checkpoint → `.*` (ExitPlanMode detection still needed) | 2026-04-17 |
| context_critical pipeline (v2.4.0) | StatusLine hook writes flag to cache; session-checkpoint reads on next PostToolUse; replaces 25-message threshold | 2026-04-17 |

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
