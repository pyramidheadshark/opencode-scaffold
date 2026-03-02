# Architecture — ml-claude-infra

This document covers two things:
1. **System overview** — what the system is, how the components fit together
2. **ADRs** — key architectural decisions and their rationale

For usage, see `README.md` and `docs/INTEGRATION.md`.

---

## System Overview

`ml-claude-infra` is a Claude Code configuration layer — a portable set of skills, hooks, agents, and commands that turns Claude Code into a disciplined ML engineering assistant.

```
ml-claude-infra/
├── .claude/
│   ├── hooks/                    # Lifecycle automation (Node.js + Bash)
│   │   ├── skill-activation-prompt.js   # UserPromptSubmit: injects skills
│   │   ├── skill-activation-logic.js    # Core matching logic (pure, testable)
│   │   ├── python-quality-check.sh      # PostToolUse: ruff + mypy on edits
│   │   └── post-tool-use-tracker.sh     # PostToolUse: tool usage log
│   ├── skills/                   # 14 domain skill modules
│   │   ├── skill-rules.json      # Trigger rules for all skills
│   │   ├── python-project-standards/
│   │   ├── fastapi-patterns/
│   │   ├── rag-vector-db/        # SKILL.md + resources/ (progressive disclosure)
│   │   └── ... (14 total)
│   ├── agents/                   # 8 specialized sub-agents
│   ├── commands/                 # 4 slash commands
│   └── CLAUDE.md                 # Core identity + interaction principles
├── scripts/
│   ├── deploy.py                 # Cross-platform deploy wizard
│   ├── deploy.sh                 # Bash deploy (Linux/macOS)
│   └── generate_skill_rules.py   # Skill rules filter for target projects
├── templates/                    # Project scaffold (pyproject.toml, Dockerfile, etc.)
├── tests/
│   ├── hook/                     # Jest: 37 tests (unit + E2E process)
│   ├── infra/                    # Python unittest: 31 structural tests
│   └── fixtures/                 # Mock project for E2E tests
└── docs/
    ├── INTEGRATION.md / .ru.md   # Deploy guide EN + RU
    ├── ARCHITECTURE.md           # This document
    └── CHANGELOG.md
```

---

## Component Details

### Skill System

Skills are Markdown files injected into Claude's `system_prompt_addition` on each prompt.

**Activation pipeline:**

```
User types prompt
      │
      ▼
skill-activation-prompt.js
  ├── reads dev/status.md            → always injected first
  ├── reads git status --porcelain   → changed files list
  ├── matchSkills(rules, prompt, files, maxSkills=3)
  │     ├── skip if rule.optional == true
  │     ├── hit if triggers.always_load == true
  │     ├── hit if keyword_match_count >= min_keyword_matches (default 1)
  │     └── hit if file pattern matches changed files
  └── loadSkillContent() → compress if > 300 lines
        └── inject as ## Skill: <name>\n\n<content>
```

**Skill categories:**

| Category | Skills | Activation |
|---|---|---|
| Always on | `python-project-standards` | `always_load: true` |
| Domain | `fastapi-patterns`, `rag-vector-db`, `langgraph-patterns`, ... (9) | keyword / file trigger |
| Strict match | `langgraph-patterns`, `infra-yandex-cloud` | `min_keyword_matches: 2` |
| Meta (optional) | `design-doc-creator`, `skill-developer` | never auto; `--include-meta` in deploy |
| New | `github-actions` | `.github/workflows/*.yml` or CI keywords |

**Skill anatomy:**

```
skills/<name>/
├── SKILL.md              # main content (keep < 300 lines)
├── skill-metadata.json   # version, updated, size_lines, resources[]
└── resources/            # subsections loaded on explicit request
    ├── topic-a.md
    └── topic-b.md
```

### Hook Pipeline

Two hook types are registered in `.claude/settings.json`:

| Event | Hook | Action |
|---|---|---|
| `UserPromptSubmit` | `skill-activation-prompt.js` | Injects status.md + matched skills |
| `PostToolUse` | `python-quality-check.sh` | Runs `ruff check` + `mypy` on edited `.py` files |
| `PostToolUse` | `post-tool-use-tracker.sh` | Appends `{timestamp, tool}` to `.claude/logs/tool-usage.jsonl` |

### Agent System

8 sub-agents invoked via `use <agent-name>` in Claude Code:

| Agent | Trigger | Output |
|---|---|---|
| `design-doc-architect` | New project requirements | `design-doc.md` |
| `test-architect` | design-doc.md exists | Full test suite skeleton |
| `multimodal-analyzer` | PDF/DOCX/XLSX/video | Structured JSON extraction |
| `code-reviewer` | Changed files | Architectural consistency report |
| `infra-provisioner` | Infrastructure needs | Terraform + Docker Compose configs |
| `refactor-planner` | Refactoring request | Incremental refactor plan |
| `project-status-reporter` | Session end | Status report from git + coverage |
| `debug-assistant` | Error / stack trace | Systematic diagnosis + fix |

### Deploy System

Two deploy scripts — same behavior, different shell:

| Script | Platform | Mode |
|---|---|---|
| `scripts/deploy.py` | Windows / Linux / macOS | Interactive wizard + CLI |
| `scripts/deploy.sh` | Linux / macOS / Git Bash | CLI only |

Both call `generate_skill_rules.py` logic to filter `skill-rules.json` for the target project. Without `--include-meta`, optional skills are excluded from the generated rules.

### Test Architecture

| Suite | Tool | Count | What it covers |
|---|---|---|---|
| Hook unit tests | Jest | 31 | `loadSkillRules`, `matchSkills`, `loadSkillContent`, `buildInjections` |
| Hook E2E tests | Jest (spawnSync) | 6 | Real hook process: always_load, optional skip, min_matches |
| Infra contracts | Python unittest | 31 | SKILL.md structure, metadata, skill-rules.json integrity, templates |

---

## ADRs

Ключевые архитектурные решения и обоснования к ним.

---

## ADR-001: Hexagonal Architecture как базовый шаблон

**Решение:** Все проекты следуют Hexagonal (Ports & Adapters) архитектуре.

**Обоснование:**

ML-проекты особенно склонны к утечке бизнес-логики в инфраструктурный код: модели оказываются в роутерах, SQL-запросы — в сервисах, конфиги — в классах датасетов. Hexagonal Architecture решает это структурно: `core/` не знает ни о FastAPI, ни о базах данных, ни о S3. Это делает `core/` тестируемым без поднятия инфраструктуры и заменяемым без переписывания бизнес-логики.

**Альтернативы, отклонённые:**

- Layered Architecture (Controller → Service → Repository): не запрещает импорты между слоями
- Django-style fat models: anti-pattern в ML контексте

---

## ADR-002: uv как менеджер зависимостей

**Решение:** `uv` вместо `pip`, `poetry`, `conda`.

**Обоснование:**

`uv` на порядок быстрее `pip` и `poetry` (Rust-based resolver), имеет lockfile из коробки, поддерживает `pyproject.toml` стандарт, управляет версиями Python. Conda добавляет ненужную сложность и плохо интегрируется с `pyproject.toml`. Poetry медленнее и имеет исторические проблемы с resolver'ом.

---

## ADR-003: Две модели с детерминированным роутингом

**Решение:** Claude Sonnet для кода; Gemini 3 Flash Preview для мультимодальных данных. Роутинг явный, не автоматический.

**Обоснование:**

Автоматическая эскалация между моделями ("если Claude не справился, попробуй GPT-4") порождает недетерминированное поведение и усложняет отладку. Разделение по типу задачи — детерминировано и дёшево: Gemini 3 Flash обрабатывает 1M токенов PDF за доли цены Claude Opus.

---

## ADR-004: Manifest-файлы вместо DVC

**Решение:** `data/manifest.json` с SHA256 + S3 путями вместо DVC.

**Обоснование:**

DVC добавляет CLI-зависимость, отдельный remote config, и шаги `dvc pull/push` в каждый workflow. Для команды из 1–3 человек это чистый overhead. Manifest-подход даёт 80% пользы (воспроизводимость, версионирование, integrity check) с 20% усилий.

Переход на DVC обоснован при: 5+ инженеров на данных, fine-grained lineage через 10+ pipeline stages, интеграция с MLflow/Vertex AI.

---

## ADR-005: pytest-bdd поверх чистого TDD

**Решение:** BDD сценарии из design-doc → `.feature` файлы → step definitions → unit tests.

**Обоснование:**

`.feature` файлы написаны на языке бизнес-требований (Gherkin). Это создаёт прямую трассируемость: бизнес-сценарий → автоматизированный тест. Чистый TDD без BDD не даёт этой связи — тесты могут покрывать код, не покрывая требования.

---

## ADR-006: LangGraph вместо n8n и других low-code решений

**Решение:** LangGraph (Python, code-first) для всех агентных пайплайнов.

**Обоснование:**

Low-code решения (n8n, Flowise, Langflow) привязывают к UI и делают невозможным code review, version control, и автоматизированное тестирование агентных графов. LangGraph — это Python-код: тестируется, версионируется, дебаггится стандартными инструментами.

---

## ADR-007: Qdrant как дефолтный vector store

**Решение:** Qdrant для большинства RAG проектов, pgvector как альтернатива при наличии PostgreSQL.

**Обоснование:**

Qdrant — standalone сервис, Docker-friendly, поддерживает фильтрацию по payload без постройки custom индексов, имеет async Python client. pgvector проще в операционном плане (один сервис), но даёт худшую производительность при > 100k векторов и требует настройки IVFFlat индекса.

---

## ADR-008: Единый status.md вместо per-task файлов

**Решение:** Один `dev/status.md` как единственный источник состояния сессии.

**Обоснование:**

Множество файлов состояния (`task-1.md`, `task-2.md`, `context-auth.md`) создают навигационную проблему: какой файл актуальный? В начале каждой сессии нужно читать несколько файлов для восстановления контекста. Единый `status.md` с секциями Backlog / Known Issues / Architecture Decisions / Next Session Plan решает это: один файл, всегда актуальный, всегда загружается первым.

---

## ADR-009: Skill compression threshold = 300 lines

**Решение:** Скиллы > 300 строк сжимаются перед инъекцией в контекст (первые 50 строк + headers).

**Обоснование:**

При лимите в 3 скилла одновременно и среднем размере скилла 150–200 строк, полная загрузка трёх скиллов занимает ~600 строк контекста — приемлемо. Если скилл вырастает до 500+ строк, три скилла займут 1500+ строк, что значимо ест токены. 300 строк — компромисс между полнотой и экономией контекста.

---

## ADR-010: mlflow для эксперимент-трекинга вместо W&B

**Решение:** MLflow self-hosted вместо Weights & Biases или Neptune.

**Обоснование:**

W&B и Neptune — SaaS с ценой за seat и ограничениями на хранение. MLflow разворачивается локально или на том же YC VM, данные остаются у нас, нет vendor lock-in, интеграция со sklearn и LangGraph нативная.
