# claude-scaffold

**[English](README.md)** | **[Русский](README.ru.md)**

**Инфраструктура Claude Code для ML и AI-инженеров — деплой один раз, синхронизация везде, экономия 71% входящих токенов.**

Три возможности в одном репозитории: **скаффолдинг** (22 скилла, профили, хуки — деплоятся в любой проект), **оптимизация токенов** (фильтры вывода bash + настройки контекста, измеренная экономия 71.4% на Sonnet 4.6), и **управление несколькими репозиториями** (`update --all` держит все проекты в синхроне одной командой).

[![CI](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml/badge.svg)](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-scaffold?label=npm&color=blue)](https://www.npmjs.com/package/claude-scaffold)
[![npm downloads](https://img.shields.io/npm/dm/claude-scaffold?color=blue)](https://www.npmjs.com/package/claude-scaffold)
![Token Savings](https://img.shields.io/badge/экономия%20токенов-71.4%25-brightgreen)
![Jest Tests](https://img.shields.io/badge/Jest-563%20tests-brightgreen)
![Python Tests](https://img.shields.io/badge/Python-62%20tests-blue)
![Skills](https://img.shields.io/badge/skills-22-orange)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

![Demo](docs/demo.gif)

---

## Три направления

### 1. Скаффолдинг — дисциплина в каждый проект

claude-scaffold — это **центральный инфраструктурный слой**, который ты настраиваешь один раз и деплоишь везде. 22 доменных скилла загружаются автоматически исходя из того, над чем ты работаешь. Профили адаптируют CLAUDE.md под разные роли. Хуки обеспечивают проверки качества без ручной настройки.

```
claude-scaffold  ← редактируешь один раз
      │
      ├── deploy → project-a/.claude/
      ├── deploy → project-b/.claude/
      └── deploy → project-c/.claude/
```

### 2. Оптимизация токенов — экономия 71.4% (измерено)

v2.1.0 поставляется с хуком-фильтром вывода bash, который оборачивает verbose-команды перед запуском. Вместо того чтобы Claude читал 2000 строк вывода `pytest`, он читает 20 строк, которые важны.

```
Бенчмарк: 25 задач × Sonnet 4.6 через OpenRouter
  Baseline:  25,084 входящих токена
  Optimized:  7,178 входящих токенов
  Экономия:     71.4%
```

Также включены: ограничение контекста `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` как дефолт деплоя, напоминание `/compact` на вызове 25, и опциональная маршрутизация административных агентных задач на `claude-haiku-4-5`.

### 3. Управление несколькими репозиториями — одна команда синхронизирует 29+ проектов

```
npx claude-scaffold update --all            # синхронизировать все проекты
npx claude-scaffold update --all --dry-run  # посмотреть что изменится
npx claude-scaffold status                  # показать дрифт версий
```

Когда ты улучшаешь хук, скилл или CLAUDE.md — каждый проект получает обновление. Никакого копирования, никакого дрейфа.

---

## Зачем claude-scaffold?

**До:** у каждого проекта свой CLAUDE.md, скопированный по памяти. Хуки не синхронизированы, каждый проект дрейфует к разным стандартам. Счета за токены растут, пока Claude читает полный вывод `git log` и `pytest` дословно.

**После:** единый источник правды. Улучшения распространяются на все проекты одной командой. Claude читает отфильтрованный вывод — на 71% меньше входящих токенов на измеренных нагрузках.

### Почему не просто скопировать CLAUDE.md?

Один CLAUDE.md работает для одного проекта. claude-scaffold добавляет:
- **Механизм синхронизации** — `update --all` держит все проекты в синхроне одной командой
- **Фильтрация вывода** — хук bash-фильтра сокращает входящие токены на 71.4% для verbose-команд
- **Инъекция скиллов** — 22 доменных скилла, загружаемых автоматически по промпту через динамический бюджет строк
- **Система профилей** — разный CLAUDE.md для каждой роли (ML-инженер, FastAPI-разработчик, AI-разработчик, fullstack)
- **Инфраструктура хуков** — трекинг сессий, онбординг, проверки качества — всё подключается автоматически

---

## Быстрый старт

```bash
# Интерактивный визард — спросит профиль, язык, CI, deploy target
npx claude-scaffold init /path/to/my-project

# Однострочник с профилем
npx claude-scaffold init /path/to/my-project --profile ml-engineer --lang ru
```

Профили: `ml-engineer` · `ai-developer` · `fastapi-developer` · `fullstack` · `hub` · `task-hub`
Языки: `en` · `ru`

```bash
# Редактирование контекста сессии после деплоя
code /path/to/my-project/dev/status.md

# Синхронизация всех проектов
npx claude-scaffold status        # показать все зарегистрированные проекты + дрифт версий
npx claude-scaffold update --all  # синхронизировать все устаревшие проекты
npx claude-scaffold update /path  # синхронизировать один проект
```

> Альтернативный деплой через Python (без npm): [docs/INTEGRATION.md](docs/INTEGRATION.md)

---

## Продвинутое: Org-профили (Команды)

Для команд с общими конвенциями — инфраструктурная топология, правила именования, внутренние ссылки — org-профили добавляют организационный слой CLAUDE.md поверх ядра scaffold. Этот слой переживает `update --all` и обновляется независимо.

```bash
# Деплой с org-профилем (командный CLAUDE.md)
npx claude-scaffold init /path/to/repo --profile ai-developer --org-profile techcon-ml --org-type ml-pipeline

# Список доступных org-профилей и типов
npx claude-scaffold list-org-profiles

# Обновить CLAUDE.md во всех org-репозиториях (читает org-profiles/<org>/repos.json)
npx claude-scaffold update-org-profile --org techcon-ml

# Явно указать список репозиториев
npx claude-scaffold update-org-profile --org techcon-ml --repos /path/a,/path/b
```

Org-профили хранятся в `org-profiles/<org-name>/` в scaffold-репозитории. По умолчанию в `.gitignore` — внутренние данные организации остаются приватными.

---

## Что делает

При каждом промпте в Claude Code хук автоматически:
1. Внедряет `dev/status.md` — текущее состояние и следующие шаги проекта
2. Определяет намерение планирования и напоминает войти в plan mode
3. Сопоставляет промпт с 22 правилами скиллов (ключевые слова + изменённые файлы + триггеры платформы)
4. Внедряет до 2 релевантных скиллов в `system_prompt_addition`
5. В первой сессии нового проекта с минимумом скиллов — предлагает запустить `claude-scaffold discover`
6. Проверяет наличие session contract (с сессии 2+) — напоминает запустить `claude-scaffold new-session "цель"`

Скиллы привносят доменные знания: паттерны FastAPI, RAG-пайплайны, графы LangGraph, конфиги CI/CD, test-first воркфлоу — только когда нужно, сжатые если крупные.

---

## Компоненты

### 22 Скилла

| Скилл | Триггеры |
|---|---|
| `python-project-standards` | **Всегда загружается** (always_load: true) |
| `critical-analysis` | hypothesis, experiment, bottleneck, рефактор, подход, метрик (>=2 ключевых слова, priority=0) |
| `fastapi-patterns` | FastAPI, роутеры, эндпоинты, Pydantic |
| `htmx-frontend` | HTMX, шаблоны Jinja2, SSR |
| `ml-data-handling` | pickle, ONNX, Parquet, S3, артефакты |
| `multimodal-router` | PDF, DOCX, видео, анализ изображений, Gemini |
| `langgraph-patterns` | langgraph + state/graph/node (мин. 2 ключевых слова) |
| `rag-vector-db` | Qdrant, pgvector, эмбеддинги, чанкинг, RAG |
| `nlp-slm-patterns` | Presidio, spaCy, Ollama, vLLM, PII |
| `predictive-analytics` | sklearn, MLflow, Optuna, feature engineering |
| `experiment-tracking` | MLflow, model registry, log_metric, experiment |
| `data-validation` | pandera, great expectations, schema validation |
| `infra-yandex-cloud` | terraform + yandex/docker (мин. 2 ключевых слова) |
| `test-first-patterns` | pytest, BDD, Gherkin, фикстуры, coverage |
| `github-actions` | `.github/workflows/*.yml`, CI/CD джобы |
| `claude-api-patterns` | anthropic SDK, tool_use, MessageCreate |
| `prompt-engineering` | system_prompt, few_shot, chain-of-thought, eval |
| `database-migration-safety` | alembic, migration, schema, upgrade/downgrade (>=2 ключевых слова) |
| `supply-chain-auditor` | dependency, CVE, audit, pip install, vulnerable (>=2 ключевых слова) |
| `design-doc-creator` | *Мета — только вручную, не загружается автоматически* |
| `skill-developer` | *Мета — только вручную, не загружается автоматически* |

### 9 Агентов

`design-doc-architect` · `test-architect` · `multimodal-analyzer` · `code-reviewer` · `infra-provisioner` · `refactor-planner` · `project-status-reporter` · `debug-assistant` · `status-updater`

### 4 Команды

`/init-design-doc` · `/new-project` · `/review` · `/dev-status`

### 8 Хуков

| Хук | Событие | Действие |
|---|---|---|
| `skill-activation-prompt.js` | UserPromptSubmit | Инъекция status.md + подходящих скиллов + напоминание plan-mode |
| `session-safety.js` | PreToolUse | Классификация Bash-команд (CRITICAL/MODERATE/SAFE), создание git-снапшотов |
| `bash-output-filter.js` | PreToolUse | Оборачивает verbose-команды (pytest, git log, docker build и др.) фильтрами вывода |
| `session-start.js` | SessionStart | Определение платформы (win32/unix), инъекция Windows-правил, онбординг |
| `session-checkpoint.js` | PostToolUse | Авто-чекпоинт при подтверждении плана; сигнал compact при критическом уровне контекста |
| `post-tool-use-tracker.js` | PostToolUse (Bash\|Edit\|Write) | Логирование вызовов инструментов в `.claude/logs/` |
| `session-status-monitor.js` | StatusLine | Отображает `ctx: ⚠ X%` в статусбаре; записывает флаг `context_critical` в session cache |
| `python-quality-check.js` | Stop | Запуск ruff + mypy при завершении сессии |

### Безопасность сессий

`session-safety.js` отслеживает каждую Bash-команду, которую выполняет Claude, и классифицирует её как CRITICAL, MODERATE или SAFE на основе паттернов из `destructive-patterns.json`.

На каждую **CRITICAL** команду (`git reset --hard`, `rm -rf`, `DROP TABLE`, `curl | bash` и т.д.) хук создаёт **git tag — точку восстановления** перед выполнением операции:

- Первый снапшот: `claude/s-{session8}`
- Второй снапшот в той же сессии: `claude/s-{session8}-2`
- Восстановление: `git reset --hard claude/s-{session8}`

Уведомление появляется в начале следующего промпта. Аудит-трейл можно просмотреть в любое время:

```bash
npx claude-scaffold session-logs --tail 20   # последние 20 событий
npx claude-scaffold session-logs --list       # все сессии
npx claude-scaffold session-logs --session abc12345
```

JSONL-логи записываются в `.claude/logs/sessions/` (в gitignore), автоматическая ротация после 30 файлов.

---

## Предустановленные профили

| Тип проекта | Скиллы |
|---|---|
| `ml-engineer` | python-project-standards, ml-data-handling, predictive-analytics, rag-vector-db, langgraph-patterns, test-first-patterns |
| `ai-developer` | python-project-standards, fastapi-patterns, multimodal-router, langgraph-patterns, github-actions, test-first-patterns |
| `fastapi-developer` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `fullstack` | python-project-standards, fastapi-patterns, htmx-frontend, test-first-patterns, github-actions |
| `hub` | python-project-standards, critical-analysis, rag-vector-db, prompt-engineering |
| `task-hub` | python-project-standards, critical-analysis |

---

## Реестр скиллов (v1.6.0+)

Поиск, просмотр и установка верифицированных скиллов из официального реестра или сторонних источников:

```bash
npx claude-scaffold registry search "frontend"    # поиск по имени/тегам
npx claude-scaffold registry install astro-skill   # скачать + проверить sha256
npx claude-scaffold registry list                  # список всех доступных скиллов
npx claude-scaffold registry update                # обновить кеш из источников
npx claude-scaffold registry add-source "my-org" "https://..." --trust community
```

Уровни доверия: `verified` (автоустановка), `community` (требует подтверждения), `untrusted` (ручная проверка).

---

## Экосистемные фичи (v2.0.0+)

### Кросс-репо зависимости

Объявление зависимостей между проектами через `deps.yaml` в корне проекта:

```yaml
project: my-project
depends_on:
  - repo: my-hub
    type: knowledge
blockers:
  - id: BLK-001
    description: "Проблема с латентностью"
    status: open
```

```bash
npx claude-scaffold deps status                          # граф зависимостей
npx claude-scaffold deps add my-hub --type knowledge     # добавить зависимость
npx claude-scaffold deps update-blocker BLK-001 --status resolved
```

Зависимости инъецируются при старте сессии. Открытые блокеры вызывают периодические напоминания.

### Манифест инфраструктуры

Создайте `INFRA.yaml` чтобы предотвратить галлюцинации IP/hostname:

```yaml
vms:
  my-server:
    vpc_ip: "192.168.0.10"
    public_ip: "1.2.3.4"
    role: app-server
rules:
  - "НИКОГДА не использовать публичный IP для внутренней коммуникации"
```

Краткая сводка инъецируется при старте сессии. Полный манифест — через команду `/infra`.

### Расширения агентов

Расширение базовых агентов проектно-специфичными инструкциями:

```
.claude/agent-extensions/code-reviewer.md   # дополняется к базовому code-reviewer
.claude/agent-extensions/my-agent.md        # полностью кастомный агент
```

Расширения конкатенируются с базовыми агентами при деплое/обновлении. Пользовательские расширения никогда не перезаписываются.

### Контекстуальный PITFALLS.md

`.claude/PITFALLS.md` содержит известные подводные камни, организованные по категориям (Docker, Terraform, Auth и т.д.). Только релевантные секции инъецируются на основе изменённых файлов и ключевых слов промпта.

---

## Оптимизация токенов (v2.1.0+)

### Фильтр bash-вывода

`bash-output-filter.js` оборачивает verbose-команды фильтрами вывода до их выполнения, снижая потребление input-токенов:

| Команда | Применяемый фильтр |
|---|---|
| `pytest ...` | grep FAILED/PASSED/ERROR + tail -80 |
| `git log ...` | head -30 |
| `docker build ...` | tail -30 |
| `npm install ...` | grep added/removed/vulnerabilities + tail -20 |
| `mypy ...` | grep error/warning/Found + tail -30 |
| `ruff check ...` | tail -25 |

Правила фильтрации — в `.claude/hooks/filter_rules.json` (редактируемый). Аудит-лог: `.claude/logs/filter-log.jsonl`.

**Результат бенчмарка (Sonnet 4.6, 25 задач):** 71.4% экономии input-токенов — baseline 25 084 → optimized 7 178 токенов.

### Контекстные дефолты при деплое

`deploySettings()` устанавливает эти значения как one-time дефолты при первом деплое (никогда не перезаписывает существующий конфиг):

```json
{ "env": { "CLAUDE_CODE_DISABLE_1M_CONTEXT": "1" }, "showClearContextOnPlanAccept": true }
```

### Мониторинг контекста

`session-status-monitor.js` (StatusLine хук) отображает заполненность контекстного окна в статусбаре Claude Code: `ctx: 82%` или `ctx: ⚠ 18%` при критическом уровне. При достижении порога (по умолчанию ≤ 20% осталось) автоматически записывает флаг `context_critical` в session cache — `session-checkpoint.js` читает его на следующем вызове инструмента и инжектирует compact-сигнал с напоминанием сохранить статус и использовать кнопку "Clear context". Порог настраивается:

```bash
SCAFFOLD_CONTEXT_THRESHOLD=30 claude  # срабатывать при ≤ 30% оставшегося
```

### Маршрутизация модели агента (opt-in)

При `SCAFFOLD_LIGHT_AGENTS=true` административные задачи (обновление статуса, бэклог) направляются в оптимизированный агент `status-updater` с `claude-haiku-4-5-20251001`:

```bash
SCAFFOLD_LIGHT_AGENTS=true claude
```

---

## Управление сессиями (v2.2.0+)

### Session Contract

Отслеживайте цель сессии и предотвращайте дрейф контекста в долгих проектах:

```bash
claude-scaffold new-session "реализовать JWT аутентификацию"
# → создаёт dev/active/session-YYYY-MM-DD.md
# → хук session-start напоминает о контракте начиная с сессии 2+
```

### Skill Discovery

Автоматически определяет стек проекта и подбирает релевантные скиллы из реестра:

```bash
claude-scaffold discover             # определяет React, FastAPI, Rust, Go и др.
claude-scaffold discover frontend    # поиск по тегу
claude-scaffold discover --install   # автоматически установить лучшие совпадения
```

В первой сессии нового проекта с минимумом скиллов `session-start.js` автоматически предлагает запустить `discover`.

### Model Router

Переключайте профили стоимость/качество без редактирования env-файлов:

```bash
claude-scaffold use sonnet           # полное качество (по умолчанию)
claude-scaffold use haiku            # ниже стоимость для рутинных задач
claude-scaffold use gemini-flash     # OpenRouter для мультимодальных задач
claude-scaffold install-aliases      # добавить алиасы: use-sonnet, use-haiku и др.
```

---

## Варианты деплоя

### Вариант A — NPX (без клонирования)

```bash
npx claude-scaffold init /path/to/my-project
npx claude-scaffold init /path/to/my-project --profile ml-engineer --lang ru
```

### Вариант B — Клонирование и деплой (Python, без npm)

```bash
git clone https://github.com/pyramidheadshark/claude-scaffold
cd claude-scaffold

# Интерактивный визард
python scripts/deploy.py

# CLI — выбранные скиллы + CI-профиль
python scripts/deploy.py /path/to/my-project \
  --skills python-project-standards,fastapi-patterns,test-first-patterns \
  --ci-profile fastapi
```

### Проверка работы хука

```bash
cd /path/to/my-project
echo '{"prompt":"pyproject.toml ruff setup"}' | node .claude/hooks/skill-activation-prompt.js
# → JSON с python-project-standards в system_prompt_addition
```

> Примеры полных конфигураций проектов: [examples/](examples/)

---

## Маршрутизация моделей

| Задача | Модель | Провайдер |
|---|---|---|
| Код, архитектура, тесты, рефакторинг | `claude-sonnet-4-6` | Claude Code подписка |
| PDF / изображения / видео / аудио анализ | `google/gemini-3-flash-preview` | OpenRouter |
| Документы > 400k токенов | `google/gemini-3-flash-preview` | OpenRouter |

Маршрутизация **явная** — запускается вручную через скилл `multimodal-router`, никогда автоматически.

---

## Бюджет токенов

| Компонент | Токенов / промпт |
|---|---|
| `dev/status.md` | ~200 |
| Малый скилл (< 150 строк) | ~800-1 200 |
| Средний скилл (150-250 строк) | ~1 500-2 500 |
| Сжатый скилл (> 300 строк) | ~600 (только заголовки) |
| Типичная сессия (status + 2 скилла) | ~3 500-5 500 |

На контекстном окне 200K: < 3% оверхеда на промпт.

---

## Совместимость

| ОС | Node | Python | Статус |
|----|------|--------|--------|
| Windows 11 (Git Bash) | >=18 | >=3.11 | Протестировано |
| macOS 14+ | >=18 | >=3.11 | Протестировано |
| Ubuntu 22.04+ | >=18 | >=3.11 | Протестировано |

---

## Структура репозитория

```
claude-scaffold/
├── .claude/
│   ├── skills/          # 22 скилл-модуля (SKILL.md + resources/ + skill-metadata.json)
│   ├── hooks/           # автоматизация жизненного цикла (7 хуков)
│   ├── agents/          # 9 суб-агентов
│   ├── commands/        # 5 slash-команд
│   └── CLAUDE.md        # базовый профиль + принципы взаимодействия
├── scripts/
│   ├── deploy.py        # кросс-платформенный визард деплоя (--status, --update, --update-all)
│   ├── benchmark/
│   │   ├── token_runner.py   # запуск бенчмарка через OpenRouter (--mode baseline|optimized)
│   │   ├── tasks.json        # 25 задач (bash_filter, skill_activation, no_filter_expected)
│   │   ├── gen_tasks.py      # генератор задач
│   │   └── report.py         # Markdown + встроенные PNG → dev/benchmark-log.md
│   └── metrics-report.js
├── templates/           # pyproject.toml, Dockerfile, docker-compose, профили GitHub Actions
├── tests/
│   ├── hook/            # Jest-тесты хуков
│   ├── infra/           # Python-тесты (57 всего)
│   └── fixtures/        # мок-проект для E2E
├── docs/
│   ├── INTEGRATION.md   # руководство по деплою (EN)
│   ├── INTEGRATION.ru.md
│   ├── ARCHITECTURE.md  # обзор системы + ADR
│   ├── REFERENCE.md     # бюджет токенов, маршрутизация моделей, структура репо
│   └── CHANGELOG.md
└── dev/
    └── status.md        # контекст сессии
```

---

## Запуск тестов

```bash
npm test                          # 563 Jest + 62 Python
npm run test:hook                 # только тесты хуков
npm run check:budget              # проверить что все скиллы < 300 строк
npm run metrics                   # отчёт по частоте загрузки скиллов

# Бенчмарк (требует OPENROUTER_API_KEY)
npm run bench:check               # проверить SDK + API-ключ
npm run bench:full                # baseline + optimized прогоны → dev/benchmark-log.md
npm run bench:token               # только замер токенов (без отчёта)
npm run bench:report              # сгенерировать отчёт из последних JSONL-файлов
```

---

## Настройка VS Code

Рекомендуемые расширения:
- `anthropic.claude-code` — официальное расширение Claude Code
- `charliermarsh.ruff` — линтинг в реальном времени
- `eamodio.gitlens` — inline git-история
- `usernamehw.errorlens` — inline отображение ошибок (в паре с mypy)

---

## Документация

- [Integration Guide (EN)](docs/INTEGRATION.md)
- [Integration Guide (RU)](docs/INTEGRATION.ru.md)
- [Architecture + ADRs](docs/ARCHITECTURE.md)
- [Reference: бюджет токенов, маршрутизация моделей, структура](docs/REFERENCE.md)
- [Changelog](docs/CHANGELOG.md)
