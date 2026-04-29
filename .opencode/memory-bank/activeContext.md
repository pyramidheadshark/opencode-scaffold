# Active Context — OpenCode Production Setup

**Обновлено**: 2026-04-29
**Статус**: OpenCode настроен и верифицирован. Переход от scaffold CLI → нативный OpenCode + плагины завершён.

---

## Текущий фокус

OpenCode + oh-my-opencode/Sisyphus работает. Все критические гэпы закрыты плагинами. Следующий шаг — перезапуск для активации новых плагинов и тест Kimi K2.6.

---

## Конфигурация (верифицирована)

### Модели

| Роль | Модель | OpenRouter ID | Стоимость (in/out per 1M) |
|------|--------|---------------|--------------------------|
| Оркестратор | GLM 5.1 | `z-ai/glm-5.1` | — |
| Deep Worker | **Kimi K2.6** | `moonshotai/kimi-k2.6` | $0.60 / $2.80 |
| Quick/Subagents | DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | ~$0.10 / ~$0.40 |
| Small model | DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | — |

### Плагины (12 шт)

**Установлены ранее (6):**
- `oh-my-openagent` — оркестратор Sisyphus, фоновые агенты, LSP/AST, MCP
- `@tarquinen/opencode-dcp` — обрезка устаревшего контекста
- `opencode-skillful` — lazy-load скиллов
- `opencode-mem` — локальная векторная БД для памяти
- `opencode-vibeguard` — маскировка секретов/PII
- `opencode-deepseek-thinking-fix` — корректная обработка thinking DeepSeek

**Добавлены P0 (3):**
- `opencode-command-hooks` — автозапуск тестов/линта после правок
- `setu-opencode` — guardrails + верификация (setu_verify)
- `cc-safety-net` — блокировка деструктивных команд

**Добавлены P1 (3):**
- `opencode-injection-guard` — анти-prompt-injection в tool-выходах
- `block-no-verify` — блокировка --no-verify в git
- `opencode-rules` — контекстные markdown-правила

### Агенты (5 шт)

| Агент | Модель | Права |
|-------|--------|-------|
| build | GLM 5.1 | edit:allow, bash:ask |
| plan | GLM 5.1 (temp 0.1) | edit:deny, bash:deny |
| deep-worker | **Kimi K2.6** (temp 0.3) | edit:allow, bash:allow |
| qa-engineer | DeepSeek V4 Flash (temp 0.2) | edit:deny, bash:allow |
| security-sentinel | DeepSeek V4 Flash | edit:deny |
| performance-analyst | DeepSeek V4 Flash | edit:deny |

### Скиллы (4 шт)
- `fastapi-patterns` — FastAPI архитектура, DI, middleware
- `yc-infra` — Yandex Cloud, GitHub Actions, Docker
- `ml-pipeline` — DVC, RAG, feature stores, quantization
- `pre-commit` — ruff, mypy, eslint, AI Verification Gate

---

## Анти-враньё протокол (добавлен в AGENTS.md)

- EVERY file edit → `lsp_diagnostics` на изменённых файлах
- EVERY build → exit code 0
- EVERY test run → pass (или явно указать pre-existing failures)
- NEVER claim complete без evidence
- NEVER mock data для прохождения тестов
- 3 failed fixes → STOP, REVERT, Oracle, ask user
- Fix minimally — NEVER refactor while fixing
- NEVER leave code broken after failures

---

## Scaffold CLI — решение

**Вердикт**: архивировать CLI, извлечь HIGH-value уникальные фичи как плагины/скилы.

**Заменены плагинами (8 шт):**
- 4 scaffold agents → oh-my-opencode 7 agents
- bash-output-filter → DCP
- memory bank templates → OpenCode native
- pre-commit generation → pre-commit skill
- discover command → Explorer agent
- documentation lookup → Librarian agent
- LSP integration → OpenCode native LSP
- skill sync → opencode-skillful

**Уникальные HIGH-value (8 шт, нет замены):**
1. AST RAG indexing (tree-sitter project_map.md)
2. Multi-repo sync (`update --all`)
3. CCR management + model routing modes
4. Session safety (destructive cmd classification + git snapshots)
5. Weekly quota tracking (ccusage)
6. Skill auto-activation hooks (22 skills with triggers)
7. 22 domain skills content
8. OTLP telemetry server

---

## Важные пути

| Что | Путь |
|-----|------|
| Global config | `~/.config/opencode/opencode.json` |
| Global rules | `~/.config/opencode/AGENTS.md` |
| Build prompt | `~/.config/opencode/prompts/build.txt` |
| Agents | `~/.config/opencode/agents/` |
| Skills | `~/.config/opencode/skills/` |
| Project config | `.opencode/config.json` |
| Project AGENTS.md | `AGENTS.md` (root) |
| Per-project template | `src/templates/opencode-project.jsonc` |

---

## Следующие шаги

1. **[РУЧНОЙ]** Перезапустить OpenCode для активации 6 новых плагинов
2. **[РУЧНОЙ]** Тест Kimi K2.6 — запустить задачу с `deep-worker` агентом
3. **[АВТО]** Создать per-project opencode.json для TechCon репозиториев (используя шаблон)
4. **[АВТО]** Извлечь scaffold уникальные фичи как плагины
