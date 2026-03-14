# claude-scaffold

**Инфраструктурный слой Claude Code для ML и AI-инженеров — один репозиторий, который делает Claude дисциплинированным инженерным партнёром во всех твоих проектах.**

Клонируй один раз. Деплой в любой проект одной командой. Обновляй все проекты при изменении конфига — всё синхронизируется автоматически.

[![CI](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml/badge.svg)](https://github.com/pyramidheadshark/claude-scaffold/actions/workflows/ci.yml)
![npm](https://img.shields.io/badge/npm-soon-lightgrey)
![Jest Tests](https://img.shields.io/badge/Jest-89%20tests-brightgreen)
![Python Tests](https://img.shields.io/badge/Python-43%20tests-blue)
![Skills](https://img.shields.io/badge/skills-14-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Концепция

Большинство конфигураций Claude Code привязаны к конкретному проекту и расходятся со временем. claude-scaffold — это **центральный инфраструктурный слой**, который ты настраиваешь один раз и деплоишь везде.

```
claude-scaffold  ← редактируешь один раз
      │
      ├── deploy → project-a/.claude/
      ├── deploy → project-b/.claude/
      └── deploy → project-c/.claude/

Позже: npx claude-scaffold update --all
      → все три синхронизированы, без ручного копирования
```

---

## Что делает

При каждом промпте в Claude Code хук автоматически:
1. Внедряет `dev/status.md` — текущее состояние и следующие шаги проекта
2. Определяет намерение планирования и напоминает войти в plan mode
3. Сопоставляет промпт с 14 правилами скиллов (ключевые слова + изменённые файлы)
4. Внедряет до 2 релевантных скиллов в `system_prompt_addition`

Скиллы привносят доменные знания: паттерны FastAPI, RAG-пайплайны, графы LangGraph, конфиги CI/CD, test-first воркфлоу — только когда нужно.

---

## Быстрый старт

### NPX (Phase 1+)

```bash
npx claude-scaffold init /path/to/my-project --profile ml-engineer --lang ru
```

### Клонирование

```bash
git clone https://github.com/pyramidheadshark/claude-scaffold
cd claude-scaffold
npm install
```

### Деплой в проект

```bash
python scripts/deploy.py /path/to/my-project --all --ci-profile fastapi
```

### Обновление всех проектов

```bash
npx claude-scaffold update --all
# или
python scripts/deploy.py --update-all
```

---

## Профили

| Профиль | Скиллы | Акцент |
|---------|--------|--------|
| `ml-engineer` | python-standards, ml-data-handling, predictive-analytics, rag-vector-db, langgraph | Chip Huyen, гексагональная архитектура, ML-воркфлоу |
| `ai-developer` | python-standards, fastapi, multimodal-router, langgraph, github-actions | Claude API, prompt engineering, агентные паттерны |
| `fastapi-developer` | python-standards, fastapi, htmx-frontend, test-first, github-actions | FastAPI, TDD, CI/CD |
| `fullstack` | python-standards, fastapi, htmx-frontend, ml-data-handling, test-first | Full stack + ML-пайплайн |

---

## 14 Скиллов

| Скилл | Триггеры |
|---|---|
| `python-project-standards` | **Всегда загружается** (always_load: true) |
| `fastapi-patterns` | FastAPI, роутеры, эндпоинты, Pydantic |
| `htmx-frontend` | HTMX, шаблоны Jinja2, SSR |
| `ml-data-handling` | pickle, ONNX, Parquet, S3, артефакты |
| `multimodal-router` | PDF, DOCX, видео, анализ изображений, Gemini |
| `langgraph-patterns` | langgraph + state/graph/node (мин. 2 ключевых слова) |
| `rag-vector-db` | Qdrant, pgvector, эмбеддинги, чанкинг, RAG |
| `nlp-slm-patterns` | Presidio, spaCy, Ollama, vLLM, PII |
| `predictive-analytics` | sklearn, MLflow, Optuna, feature engineering |
| `infra-yandex-cloud` | terraform + yandex/docker (мин. 2 ключевых слова) |
| `test-first-patterns` | pytest, BDD, Gherkin, фикстуры, coverage |
| `github-actions` | `.github/workflows/*.yml`, CI/CD джобы |
| `design-doc-creator` | *Мета — только вручную* |
| `skill-developer` | *Мета — только вручную* |

---

## Запуск тестов

```bash
npm run test:hook         # 89 Jest-тестов (unit + E2E + session-start)
npm run test:cli          # 29 Jest-тестов (CLI команды)
python tests/infra/test_infra.py  # 43 Python-теста (инфра-контракты)
npm run check:budget      # проверить что все скиллы < 300 строк
npm run metrics           # отчёт по частоте загрузки скиллов
```

---

## Структура репозитория

```
claude-scaffold/
├── .claude/
│   ├── skills/          # 14 скилл-модулей (SKILL.md + resources/ + skill-metadata.json)
│   ├── hooks/           # автоматизация жизненного цикла
│   ├── agents/          # 8 специализированных агентов
│   ├── commands/        # 4 slash-команды
│   └── CLAUDE.md        # базовый профиль ML-инженера
├── bin/
│   └── cli.js           # NPX точка входа
├── lib/
│   ├── commands/        # init, update, status, add-skill
│   ├── deploy/          # copy, registry, git
│   ├── ui/wizard.js     # интерактивный визард
│   ├── profiles.js      # профили → наборы скиллов
│   └── i18n.js          # EN/RU сообщения
├── scripts/
│   └── deploy.py        # Python CLI (legacy, полностью функциональный)
├── templates/
│   ├── profiles/        # CLAUDE.md.en + CLAUDE.md.ru для каждого профиля
│   └── github-actions/  # 4 CI-профиля + deploy-фрагменты
└── tests/
    ├── hook/            # Jest-тесты
    ├── cli/             # Jest-тесты CLI
    └── infra/           # Python-тесты
```

---

## Документация

- [Integration Guide (EN)](docs/INTEGRATION.md)
- [Integration Guide (RU)](docs/INTEGRATION.ru.md)
- [Architecture + ADRs](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
