# Design Document: Scaffold TUI

> Status: DRAFT
> Version: 0.1.0
> Last updated: 2026-04-18
> Authors: Aleksandr Vasilev, Claude Code

---

## 0. Quick Summary

| Field | Value |
|---|---|
| Project | scaffold-tui |
| Business goal | Единая интерактивная консоль для управления claude-scaffold — агенты, задачи, конфигурация |
| Core problem | Всё управление скаффолдом разбросано по CLI-командам; нет способа видеть статус агентов в реальном времени, управлять очередью задач и конфигурацией в одном месте |
| Solution | TUI на базе blessed + node-pty, запускается как `claude-scaffold tui`, поддерживает drill-in в любой агентский процесс |
| Stack | Node.js + blessed + node-pty + JSON task queue |
| Target deploy | Локально на машине разработчика (не деплоится в target репо) |

---

## 1. Business Context

### 1.1 Problem Statement

Сейчас для управления скаффолдом нужно помнить 10+ CLI-команд (`init`, `tune`, `update --all`, `discover`, `org-profile`, etc.). Нет обзора того, что происходит в 30 задеплоенных репо. Когда агент блокируется (session-safety.js), об этом не знаешь — нет мониторинга. Запустить одну задачу в нескольких репо параллельно невозможно без внешних скриптов.

### 1.2 Business Goal

К 20 апреля 2026: полноценный TUI с очередью задач, пулом агентов и конфигурацией. MVP к 19 апреля: только вкладка Config.

### 1.3 Scope

**In scope:**
- Панель Config: управление deployed-repos.json, skill-rules.json, tuning settings
- Панель Agents: пул claude-воркеров, статусы, drill-in в PTY
- Панель Pipeline: очередь задач (ручное добавление + Claude auto-generate)
- Панель Artifacts: выходные данные завершённых задач
- Drill-in overlay: передача keyboard в PTY конкретного агента
- `claude-scaffold tui` команда как точка входа

**Out of scope:**
- Деплой в target репо (TUI — только локальный инструмент)
- Web UI / браузерный интерфейс
- Windows без Windows Terminal (cmd.exe / старый PowerShell)
- Персистентная база задач (JSON файла достаточно для MVP)
- Удалённые агенты (только localhost)

### 1.4 Key Decisions Already Made

| Decision | Choice | Rationale |
|---|---|---|
| TUI библиотека | blessed | Лучше Ink для сложных multi-panel layouts с произвольным позиционированием |
| PTY для агентов | @lydell/node-pty | Prebuilt binaries для Mac/Linux/Windows без node-gyp; graceful fallback если не загрузился |
| Task queue storage | JSON файл (`~/.claude-scaffold/tasks.json`) | Нет новых зависимостей, рестартуемо |
| Агент-воркер | `claude --print` для авто-задач, `claude` (interactive) для drill-in | `--print` не требует TTY; drill-in переключает в interactive |
| Точка входа | `claude-scaffold tui` — новая команда в bin/cli.js | Consistent с остальными командами |

### 1.5 Open Business Questions

- [x] Сколько агентов: `Math.max(2, Math.floor(os.cpus().length / 2))`, конфигурируемо
- [x] Auto-генерация задач: `claude --print` с явной JSON-схемой в промпте

---

## 2. Users and Roles

| # | Role | Description | Est. Count | Scenarios |
|---|---|---|---|---|
| 1 | Developer (owner) | Александр — основной пользователь, управляет 30 репо | 1 | все |
| 2 | Scaffold user | Пользователь задеплоенного скаффолда, запускает TUI локально | ~10 | #1, #3, #4 |

### Expected Load

| Metric | Value | Notes |
|---|---|---|
| Concurrent agents | 1–8 | Зависит от CPU/памяти |
| TUI refresh rate | ≤100ms | Субъективно отзывчиво |
| Task queue depth | до 100 задач | JSON файл справляется |

---

## 3. Input Data

| # | Source | Format | Volume | Description | Status |
|---|---|---|---|---|---|
| 1 | `deployed-repos.json` | JSON | ~30 записей | Список задеплоенных репо | Exists |
| 2 | `skill-rules.json` | JSON | ~20 правил | Правила инжекции скилов | Exists |
| 3 | `settings.json` | JSON | ~50 ключей | Настройки Claude Code | Exists |
| 4 | `~/.claude-scaffold/tasks.json` | JSON | до 100 задач | Очередь задач TUI | Создаётся TUI |
| 5 | stdout агентов | text stream | непрерывный | Выходные данные claude процессов | Runtime |

---

## 4. Use Cases and Scenarios

### Scenario 1: Открыть Config и сменить профиль репо (MVP)

**Actor**: Developer  
**Trigger**: `claude-scaffold tui`, переход на вкладку Config  
**Preconditions**: `deployed-repos.json` существует

**Main flow**:
1. Пользователь запускает `claude-scaffold tui`
2. TUI открывается на вкладке Config
3. Список репо из `deployed-repos.json` — название, текущий профиль, SHA
4. Пользователь выбирает репо → выбирает новый профиль → подтверждает
5. TUI запускает `claude-scaffold tune --profile X` для выбранного репо
6. Статус обновляется

**Alternative flows**:
- Репо не отвечает → показать ошибку, не блокировать UI

**Priority**: High (MVP)

---

### Scenario 2: Добавить задачу вручную

**Actor**: Developer  
**Trigger**: Нажать `a` на вкладке Pipeline  
**Preconditions**: TUI запущен

**Main flow**:
1. Открывается форма: repo path, task description, priority
2. Задача добавляется в `tasks.json` со статусом `queued`
3. Свободный агент забирает задачу → статус `running`
4. Агент завершает → статус `done`, output → Artifacts

**Priority**: High

---

### Scenario 3: Drill-in в агента (approve blocked command)

**Actor**: Developer  
**Trigger**: Агент переходит в статус `blocked` (session-safety.js заблокировал команду)  
**Preconditions**: Агент запущен с задачей

**Main flow**:
1. TUI показывает агента со статусом `⚠ blocked`
2. Пользователь нажимает Enter на агенте → открывается DrillIn overlay
3. Overlay занимает 80% экрана, показывает PTY вывод агента
4. Keyboard теперь идёт в PTY агента
5. Пользователь вводит `y` или команду → агент продолжает
6. Нажать Esc → выход из drill-in, TUI возвращается в обзорный режим

**Priority**: High

---

### Scenario 4: Claude auto-генерирует batch задачи

**Actor**: Developer  
**Trigger**: Нажать `g` → ввести инструкцию ("security review all repos")  
**Preconditions**: Минимум 1 репо в `deployed-repos.json`

**Main flow**:
1. TUI запускает `claude --print "generate task list: security review all repos"` с контекстом deployed-repos.json
2. Claude возвращает JSON массив задач
3. Задачи добавляются в очередь
4. Агенты разбирают задачи параллельно

**Priority**: Medium

---

### Scenario 5: Просмотр Artifacts

**Actor**: Developer  
**Trigger**: Завершение задачи / переход на вкладку Artifacts  
**Preconditions**: Минимум одна задача выполнена

**Main flow**:
1. Artifacts панель показывает список выходных данных (тип: plan/report/note)
2. Выбрать артефакт → просмотр содержимого в overlay
3. Опционально: сохранить в файл

**Priority**: Low

---

## 5. Non-Functional Requirements

| # | Category | Requirement | Status | Notes |
|---|---|---|---|---|
| 1 | Performance | TUI refresh ≤100ms | Agreed | blessed render loop |
| 2 | Reliability | Graceful shutdown: drain tasks, kill agents cleanly | Agreed | SIGINT handler |
| 3 | Compatibility | macOS + Linux + Windows Terminal | Agreed | @lydell/node-pty prebuilt; graceful fallback без drill-in |
| 4 | Dependencies | Только blessed + node-pty как новые deps | Agreed | Минимализм |
| 5 | Persistence | Task queue выживает перезапуск TUI | Agreed | JSON файл |
| 6 | Security | Не деплоить TUI в target репо | Agreed | Только локальный инструмент |

---

## 6. Technical Architecture

### 6.1 Stack

```
TUI:         blessed (multi-panel, box components, keyboard)
PTY:         @lydell/node-pty (prebuilt binaries, Mac/Linux/Windows, graceful fallback)
Task queue:  JSON file (~/.claude-scaffold/tasks.json)
Agent:       claude CLI (--print для авто-задач, interactive для drill-in)
Config mgr:  Existing lib/commands/* (init, tune, org-profile)
```

### 6.2 Repository Structure (новые файлы)

```
claude-scaffold/
├── lib/
│   └── tui/
│       ├── index.js          # точка входа, запускает blessed screen
│       ├── panels/
│       │   ├── agents.js     # AgentsPanel — список воркеров
│       │   ├── pipeline.js   # PipelinePanel — очередь задач
│       │   ├── artifacts.js  # ArtifactsPanel — выходные данные
│       │   └── config.js     # ConfigPanel — MVP
│       ├── overlays/
│       │   └── drill-in.js   # DrillIn overlay — PTY в фокусе
│       ├── orchestrator/
│       │   ├── agent-pool.js # Управление node-pty инстансами
│       │   ├── task-queue.js # JSON-based очередь
│       │   └── task-runner.js# Назначение задач агентам
│       └── config-manager.js # Чтение/запись deployed-repos, skill-rules
├── bin/
│   └── cli.js                # +tui команда
└── tests/
    └── tui/
        ├── task-queue.test.js
        ├── agent-pool.test.js
        └── config-manager.test.js
```

### 6.3 Data Flow

```
claude-scaffold tui
  └─▶ blessed screen (80x24+)
        ├─▶ ConfigPanel ──── reads/writes deployed-repos.json, skill-rules.json
        ├─▶ PipelinePanel ── reads/writes tasks.json
        │     └─▶ TaskRunner ── pulls task → assigns to free agent
        ├─▶ AgentsPanel ──── reflects AgentPool state
        │     └─▶ AgentPool ── node-pty instances, stdout → parse status
        ├─▶ ArtifactsPanel ─ collects agent outputs
        └─▶ DrillIn overlay ─ keyboard → selected agent PTY stdin
```

### 6.4 Agent State Machine

```
idle → running → done
              ↓
           blocked (session-safety.js output detected)
              ↓
         [user drill-in → approve] → running
              ↓
           stopped (user killed / error)
```

Детекция `blocked`: парсинг stdout агента на паттерн `[BLOCKED]` или `session-safety` (уже генерируется хуком).

### 6.5 IPC

Нет сокетов. TUI читает stdout агентов через EventEmitter node-pty (`onData`). Команды агенту — через `pty.write(data)`. Статус хранится в памяти `AgentPool`.

---

## 7. Test Plan

| Scenario | Test File | Priority | Status |
|---|---|---|---|
| TaskQueue add/get/complete | `tests/tui/task-queue.test.js` | High | Not started |
| AgentPool spawn/kill/status | `tests/tui/agent-pool.test.js` | High | Not started |
| ConfigManager read/write repos | `tests/tui/config-manager.test.js` | High | Not started |
| DrillIn keyboard routing | manual (TTY required) | Medium | Not started |

### Coverage Targets

- `lib/tui/orchestrator/`: ≥90%
- `lib/tui/config-manager.js`: 100%
- Panels/overlays: manual test (blessed не тестируется unit)

---

## 8. Deployment Plan

TUI не деплоится — это локальный инструмент разработчика. Поставляется как часть `claude-scaffold` npm пакета.

### Phases

| Phase | Дата | Что входит |
|---|---|---|
| MVP | 2026-04-19 | ConfigPanel только: список репо, смена профиля, просмотр skill-rules |
| Full | 2026-04-20 | Agents + Pipeline + Artifacts + DrillIn |

### Новые npm зависимости

```json
"blessed": "^0.1.81",
"@lydell/node-pty": "^0.1.0"
```

---

## 9. Open Technical Questions

- [x] **Agent output parsing**: session-safety.js добавляет маркер `[SCAFFOLD:BLOCKED]` в stdout → парсинг по этой строке. Надёжнее fuzzy-поиска.
- [x] **Max agents**: `Math.max(2, Math.floor(os.cpus().length / 2))` — масштабируется с железом, минимум 2.
- [x] **Auto-task generation**: `claude --print` с явной JSON-схемой в промпте. Шаблоны не нужны.
- [x] **Task persistence on crash**: write в `.tasks.json.tmp` → `fs.renameSync` — атомарно на одной FS, ноль зависимостей.
- [x] **Cross-platform PTY**: `@lydell/node-pty` (prebuilt binaries, Mac/Linux/Windows x64+ARM, без node-gyp). Graceful fallback: если не загрузился → drill-in недоступен, остальной TUI работает. Требование: Windows Terminal (не cmd.exe).

---

## 10. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-04-18 | Aleksandr Vasilev | Initial draft |
