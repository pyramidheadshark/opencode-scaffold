# OpenCode Production Setup Plan v2.0

**Дата**: 2026-04-29
**Цель**: Полностью рабочий prod-ready инстанс OpenCode через WSL для всех репозиториев
**Путь к файлу**: `C:\Users\pyramidheadshark\Repos\claude-scaffold\OPENCODE-PROD-SETUP-PLAN.md`

---

## 0. Критическое резюме

Scaffold CLI (opencode-scaffold) — избыточен. Вся функциональность покрывается:
- Нативной конфигурацией OpenCode (`opencode.json`)
- Готовыми плагинами из экосистемы
- Markdown-агентами и скилами

**Scaffold перепрофилируется**: вместо CLI-утилиты он становится **репозиторием конфигурационных шаблонов** — набор `opencode.json` + агенты + скилы + плагины, которые можно скопировать в любой проект.

---

## 1. WSL: Установка и настройка

### 1.1 Текущий статус

У тебя УЖЕ установлен WSL 2 с Ubuntu 24.04:
```
NAME            STATE      VERSION
*Ubuntu         Stopped    2
  Docker-desktop Stopped    2
```

Node.js внутри WSL **НЕ установлен**. `curl` и `git` есть.

### 1.2 Как запустить WSL

```powershell
# Из PowerShell / Git Bash:
wsl                          # вход в Ubuntu (дефолтный дистрибутив)
wsl -d Ubuntu                # то же самое явно
wsl -- bash -c "команда"     # выполнить одну команду из Windows
```

### 1.3 Первичная настройка WSL (один раз)

```bash
# Внутри WSL:
sudo apt update && sudo apt upgrade -y

# Установить curl, git, build-essential (git/curl уже есть, но на всякий случай)
sudo apt install -y curl git build-essential

# Установить Node.js 22 через nvm (рекомендуемый способ)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node --version   # должно быть v22.x
npm --version    # должно быть 10.x

# Установить OpenCode
curl -fsSL https://opencode.ai/install | bash

# Проверить
opencode --version
```

### 1.4 Доступ к Windows-файлам из WSL

| Windows путь | WSL путь |
|-------------|----------|
| `C:\Users\pyramidheadshark\Repos\techcon_hub` | `/mnt/c/Users/pyramidheadshark/Repos/techcon_hub` |
| `C:\Users\pyramidheadshark\Repos\claude-scaffold` | `/mnt/c/Users/pyramidheadshark/Repos/claude-scaffold` |
| `D:\` | `/mnt/d/` |

**Совет**: Для лучшей производительности клонируй репозитории внутрь WSL (`~/repos/`), а не работай через `/mnt/c/`. Но для начала `/mnt/c/` достаточно.

### 1.5 Desktop App + WSL (опционально)

Если хочешь использовать Desktop App (GUI) поверх WSL-сервера:

```bash
# В WSL:
OPENCODE_SERVER_PASSWORD=your-secret-password opencode serve --hostname 0.0.0.0 --port 4096
```

Затем в Desktop App подключись к `http://localhost:4096`.

---

## 2. Модели (OpenRouter)

### 2.1 Распределение ролей

| Роль | Модель | OpenRouter ID | Зачем |
|------|--------|---------------|-------|
| **Оркестратор / Planner** | GLM 5.1 | `openrouter/z-ai/glm-5.1` | Главный мозг — планирование, делегирование, архитектура |
| **Deep Worker** | GPT 5.4 или Codex | `openrouter/openai/gpt-5.4` / `openrouter/openai/codex-1` | Автономное выполнение сложных задач |
| **Quick Tasks** | DeepSeek V4 Flash | `openrouter/deepseek/deepseek-v4-flash` | Быстрые правки, тайпы, мелкие задачи |
| **Small model (titles, etc)** | DeepSeek V4 Flash | `openrouter/deepseek/deepseek-v4-flash` | Дешёвая модель для системных задач |

### 2.2 oh-my-opencode категории

oh-my-opencode использует автоматическую маршрутизацию по категориям. Вот как маппятся наши модели:

| Категория OmO | Роль | Модель |
|---------------|------|--------|
| `ultrabrain` | Оркестратор | `z-ai/glm-5.1` |
| `deep` | Deep Worker | `openai/gpt-5.4` |
| `visual-engineering` | Фронтенд | `openai/gpt-5.4` |
| `quick` | Quick Tasks | `deepseek/deepseek-v4-flash` |

---

## 3. Плагины

### 3.1 Обязательные (ядро)

| Плагин | npm пакет | Что даёт |
|--------|-----------|----------|
| **oh-my-opencode** | `oh-my-opencode` | Оркестратор Sisyphus, фоновые агенты, LSP/AST, Hash-Edits, Ralph Loop, MCP (Exa, Context7, grep.app), Todo Enforcer, Comment Checker, IntentGate |
| **Dynamic Context Pruning** | `@tarquinen/opencode-dcp` | Обрезка устаревшего вывода bash, экономия токенов |

### 3.2 Рекомендуемые (усиление)

| Плагин | npm пакет | Что даёт |
|--------|-----------|----------|
| **Skillful** | `opencode-skillful` | Lazy-load скиллов по требованию внутри сессии |
| **Persistent Memory** | `opencode-mem` | Локальная векторная БД для кросс-сессионной памяти |
| **VibeGuard** | `opencode-vibeguard` | Маскировка секретов/PII перед LLM |
| **Shell Strategy** | `opencode-shell-strategy` | Предотвращение зависаний от TTY-команд |
| **PTY** | `opencode-pty` | Запуск REPL, дебаггеров, TUI внутри агента |
| **Websearch Cited** | `opencode-websearch-cited` | Веб-поиск с цитированием источников |
| **Statusline** | `opencode-subagent-statusline` | Мониторинг субагентов в статусной строке |
| **DeepSeek Thinking Fix** | `opencode-deepseek-thinking-fix` | Корректная обработка thinking-контента DeepSeek V4 |

### 3.3 Опциональные (продвинутые)

| Плагин | npm пакет | Что даёт |
|--------|-----------|----------|
| **Conductor** | `opencode-conductor` | Protocol-driven: Context → Spec → Plan → Implement |
| **Background Agents** | `opencode-background-agents` | Claude Code-style фоновые агенты с async delegation |
| **Workspace** | `opencode-workspace` | 16 компонентов мульти-агентной оркестрации |
| **Sentry Monitor** | `opencode-sentry-monitor` | Трейсинг и дебаг AI-агентов через Sentry |
| **Firecrawl** | `opencode-firecrawl` | Веб-скрейпинг, краулинг, поиск |

### 3.4 Дополнительные кор-фичи (что мы упустили)

| Фича | Откуда | Зачем |
|------|--------|-------|
| **Hash-Anchored Edits** | oh-my-opencode (встроено) | Модель редактирует по хешу строки, а не по её содержимому. Успешность правок: 6.7% → 68.3% |
| **Ralph Loop** | oh-my-opencode (встроено) | Self-referential loop — агент не останавливается пока задача не 100% выполнена |
| **Todo Enforcer** | oh-my-opencode (встроено) | Если агент idle — система дергает его обратно |
| **Comment Checker** | oh-my-opencode (встроено) | Не даёт модели плодить AI-slop в комментариях |
| **IntentGate** | oh-my-opencode (встроено) | Анализ истинного интента пользователя перед классификацией |
| **Skill-Embedded MCP** | oh-my-opencode (встроено) | Скилы поднимают свои MCP-серверы on-demand, экономя контекст |
| **`/init-deep`** | oh-my-opencode (встроено) | Генерация иерархических AGENTS.md по всему проекту |
| **Session Recovery** | oh-my-opencode (встроено) | Автовосстановление после ошибок, переполнения контекста, API-сбоев |
| **Compaction Hooks** | OpenCode нативный (плагин API) | Кастомизация того, что попадает в контекст при компакции |
| **LSP + AST-Grep** | oh-my-opencode (встроено) | Workspace rename, диагностика, AST-aware переписывание кода |
| **Tmux Integration** | oh-my-opencode (встроено) | Полноценный интерактивный терминал для REPL/дебаггеров/TUI |

---

## 4. Конфигурация

### 4.1 Глобальный конфиг: `~/.config/opencode/opencode.json`

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  "model": "openrouter/z-ai/glm-5.1",
  "small_model": "openrouter/deepseek/deepseek-v4-flash",

  "provider": {
    "openrouter": {
      "options": {
        "apiKey": "{env:OPENROUTER_API_KEY}",
        "baseURL": "https://openrouter.ai/api/v1"
      }
    }
  },

  "plugin": [
    "oh-my-opencode",
    "@tarquinen/opencode-dcp",
    "opencode-skillful",
    "opencode-mem",
    "opencode-vibeguard",
    "opencode-deepseek-thinking-fix"
  ],

  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 10000
  },

  "permission": {
    "edit": "allow",
    "bash": "ask",
    "websearch": "allow",
    "webfetch": "allow",
    "skill": "allow"
  },

  "instructions": [
    "~/.config/opencode/AGENTS.md"
  ],

  "agent": {
    "build": {
      "model": "openrouter/z-ai/glm-5.1",
      "prompt": "{file:~/.config/opencode/prompts/build.txt}"
    },
    "plan": {
      "model": "openrouter/z-ai/glm-5.1",
      "temperature": 0.1,
      "permission": {
        "edit": "deny",
        "bash": "deny"
      }
    },
    "qa-engineer": {
      "description": "Strict QA engineer for E2E testing and defect reports",
      "mode": "subagent",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.2,
      "permission": {
        "edit": "deny",
        "bash": "allow"
      }
    },
    "security-sentinel": {
      "description": "Security analyst - finds vulnerabilities, injection risks, supply chain flaws",
      "mode": "subagent",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "permission": {
        "edit": "deny"
      }
    },
    "performance-analyst": {
      "description": "Performance analyst - Big-O, memory leaks, N+1 queries",
      "mode": "subagent",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "permission": {
        "edit": "deny"
      }
    }
  }
}
```

### 4.2 Глобальные правила: `~/.config/opencode/AGENTS.md`

```markdown
# Global Agent Rules

## Language
- Always respond in Russian unless the user writes in English
- Commit messages in English only, no Co-Authored-By

## Code Quality
- NEVER add comments unless explicitly asked
- Follow existing code conventions in the project
- Always check README/CLAUDE.md/AGENTS.md before making changes
- Always run lint and typecheck after completing tasks

## Safety
- Never expose secrets, API keys, or credentials
- Never run destructive git commands (push --force, hard reset) unless explicitly asked

## Memory
- Before finishing a task, update progress notes
- Check for existing patterns before introducing new libraries

## Shell
- Platform: Linux (WSL2 Ubuntu 24.04)
- Python: use python3
- Paths: use path.join() for cross-platform compatibility
- Pre-commit hooks: use bash (Git Bash available)
```

### 4.3 Промпт Build-агента: `~/.config/opencode/prompts/build.txt`

```
You are a senior ML engineer specializing in complex, production-grade systems.
Your defining trait is a pragmatic and critical approach.
You are not just an executor — you are an intellectual partner whose goal is to
create the best, most reliable, and most scalable solution.

You always think several steps ahead.
Follow TDD, Hexagonal Architecture, and never hardcode secrets.

BEFORE finishing any task, update the project's progress documentation.
Internet usage is strictly read-only for documentation (webfetch).
Never execute piped scripts (curl | bash) from the internet.

You have access to sub-agents via the 'oh-my-opencode' plugin.
When a task is complex or requires deep testing, delegate to a sub-agent
(e.g., @qa-engineer, @security-sentinel). Let them work and return only
the summary to save your context window.

Always respond in Russian unless the user writes in English.
```

### 4.4 Per-project конфиг: `opencode.json` (в корне репозитория)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openrouter/z-ai/glm-5.1",
  "instructions": ["AGENTS.md", "CONTRIBUTING.md"]
}
```

---

## 5. Кастомные агенты (Markdown)

Создать в `~/.config/opencode/agents/` (глобальные) или `.opencode/agents/` (проектные).

### `qa-engineer.md`

```markdown
---
description: Strict QA engineer for E2E testing and defect reports
mode: subagent
model: openrouter/deepseek/deepseek-v4-flash
temperature: 0.2
permission:
  edit: deny
  bash: allow
---

You are a strict QA automation engineer.
Write Pytest/Playwright E2E tests for the provided code.
Do not write features. Run the tests via bash.
If tests fail, analyze the stack trace and return a structured defect report.
You have 3 max retries to fix test environments.
Always respond in Russian unless the user writes in English.
```

### `security-sentinel.md`

```markdown
---
description: Security analyst - finds vulnerabilities, injection risks, supply chain flaws
mode: subagent
model: openrouter/deepseek/deepseek-v4-flash
temperature: 0.1
permission:
  edit: deny
---

You are a Security Sentinel reviewing a proposed technical decision.
Your sole purpose is to find vulnerabilities, injection risks, leaky abstractions,
and supply chain flaws in the code.
Read the provided diff and output ONLY security risks.
Always respond in Russian unless the user writes in English.
```

### `performance-analyst.md`

```markdown
---
description: Performance analyst - Big-O, memory leaks, N+1 queries
mode: subagent
model: openrouter/deepseek/deepseek-v4-flash
temperature: 0.1
permission:
  edit: deny
---

You are a Performance Analyst.
Review the proposed changes for Big-O complexity flaws, memory leaks, and N+1 query problems.
Suggest performance optimizations.
Always respond in Russian unless the user writes in English.
```

### `infra-provisioner.md`

```markdown
---
description: Infrastructure provisioner for Yandex Cloud, Docker, and CI/CD
mode: subagent
model: openrouter/deepseek/deepseek-v4-flash
permission:
  bash: allow
  edit: allow
---

You are an infrastructure engineer specializing in Yandex Cloud, Docker, and GitHub Actions.
Provision resources, write Dockerfiles, configure CI/CD pipelines.
All GH Actions must use self-hosted runner with label [self-hosted, ops01].
Always respond in Russian unless the user writes in English.
```

---

## 6. Скилы

Создать в `~/.config/opencode/skills/` (глобальные) или `.opencode/skills/` (проектные).

### `fastapi-patterns/SKILL.md`

```markdown
---
name: fastapi-patterns
description: FastAPI best practices, dependency injection, middleware, background tasks
license: MIT
---

## What I do
- Provide FastAPI architectural patterns and best practices
- Dependency injection patterns
- Middleware configuration
- Background task patterns
- Error handling and validation

## When to use me
Use this when working on FastAPI applications or APIs.
```

### `yc-infra/SKILL.md`

```markdown
---
name: yc-infra
description: Yandex Cloud infrastructure provisioning, GitHub Actions deployment, cloud-init
license: MIT
---

## What I do
- YC VM provisioning via CLI
- GitHub Actions self-hosted runner setup (ops01)
- Docker Compose deployment
- Cloud-init configuration

## When to use me
Use this when deploying to Yandex Cloud or configuring CI/CD pipelines.

## Critical Rules
- All .github/workflows/*.yml MUST use: runs-on: [self-hosted, ops01]
- Runner host: yc-ops-01 (84.201.161.199)
```

### `ml-pipeline/SKILL.md`

```markdown
---
name: ml-pipeline
description: ML pipeline patterns, DVC, feature stores, model quantization, RAG
license: MIT
---

## What I do
- ML pipeline architecture
- DVC for data versioning
- Model quantization patterns
- RAG/vector DB patterns
- Experiment tracking

## When to use me
Use this when building ML pipelines, RAG systems, or model training workflows.
```

### `pre-commit/SKILL.md`

```markdown
---
name: pre-commit
description: Pre-commit hooks configuration for Python and TypeScript projects
license: MIT
---

## What I do
- Generate .pre-commit-config.yaml
- Configure ruff, mypy, eslint
- Set up AI Verification Gate (pytest/npm test)

## When to use me
Use this when setting up code quality gates or pre-commit hooks.
```

---

## 7. Пошаговый план имплементации

### Обозначения
- `[РУЧНОЙ]` — шаг, который ты делаешь сам руками
- `[АВТО]` — шаг, который я выполню за тебя в этой сессии

---

### Шаг 1: Настройка WSL [РУЧНОЙ]

- [ ] Открыть PowerShell и выполнить `wsl`
- [ ] Выполнить `sudo apt update && sudo apt upgrade -y`
- [ ] Установить nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`
- [ ] Выполнить `source ~/.bashrc`
- [ ] Установить Node.js: `nvm install 22 && nvm use 22`
- [ ] Установить OpenCode: `curl -fsSL https://opencode.ai/install | bash`
- [ ] Проверить: `opencode --version`

### Шаг 2: API ключ [РУЧНОЙ]

- [ ] В WSL выполнить: `export OPENROUTER_API_KEY=sk-or-v1-...`
- [ ] Добавить в `~/.bashrc` (внутри WSL): `echo 'export OPENROUTER_API_KEY=sk-or-v1-...' >> ~/.bashrc`
- [ ] Запустить `opencode` в любой папке
- [ ] Выполнить `/connect` → выбрать OpenRouter → вставить ключ

### Шаг 3: Создать структуру конфигурации [АВТО]

- [ ] Создать `~/.config/opencode/opencode.json` (из секции 4.1)
- [ ] Создать `~/.config/opencode/AGENTS.md` (из секции 4.2)
- [ ] Создать `~/.config/opencode/prompts/build.txt` (из секции 4.3)

### Шаг 4: Создать кастомных агентов [АВТО]

- [ ] Создать `~/.config/opencode/agents/qa-engineer.md`
- [ ] Создать `~/.config/opencode/agents/security-sentinel.md`
- [ ] Создать `~/.config/opencode/agents/performance-analyst.md`
- [ ] Создать `~/.config/opencode/agents/infra-provisioner.md`

### Шаг 5: Создать скилы [АВТО]

- [ ] Создать `~/.config/opencode/skills/fastapi-patterns/SKILL.md`
- [ ] Создать `~/.config/opencode/skills/yc-infra/SKILL.md`
- [ ] Создать `~/.config/opencode/skills/ml-pipeline/SKILL.md`
- [ ] Создать `~/.config/opencode/skills/pre-commit/SKILL.md`

### Шаг 6: Пересоздать сессию [РУЧНОЙ]

- [ ] Выйти из OpenCode (если запущен): `/exit` или Ctrl+C
- [ ] Запустить `opencode` заново — плагины подтянутся автоматически
- [ ] Проверить загрузку oh-my-opencode: должен появиться Sisyphus-агент
- [ ] Проверить DCP: в логах старта должно быть "opencode-dcp loaded"

### Шаг 7: Протестировать ultrawork [РУЧНОЙ]

- [ ] В OpenCode набрать `ultrawork` (или `ulw`)
- [ ] Проверить, что Sisyphus активируется
- [ ] Проверить веб-поиск через встроенный MCP Exa
- [ ] Проверить делегирование субагентам: `@qa-engineer проверь тесты`
- [ ] Проверить скилы: `skill fastapi-patterns`

### Шаг 8: Per-project конфигурация [АВТО + РУЧНОЙ]

- [ ] [АВТО] Создать `opencode.json` в корне каждого репозитория
- [ ] [РУЧНОЙ] Запустить `/init` в каждом проекте для генерации `AGENTS.md`
- [ ] [РУЧНОЙ] Запустить `/init-deep` (от oh-my-opencode) для иерархических `AGENTS.md`

---

## 8. Что делать со Scaffold CLI

### Рекомендация: Прекратить разработку CLI сейчас

Оставить `opencode-scaffold` как архив на ветке `v2-rework`.
Перейти на нативную конфигурацию OpenCode + плагины.

Если потом понадобится — переделать Scaffold в Config Generator (`npx opencode-scaffold init`), который просто копирует шаблоны конфигов и не дублирует плагины.

---

## 9. Ссылки

- OpenCode Docs: https://opencode.ai/docs/
- oh-my-opencode: https://github.com/code-yeongyu/oh-my-openagent
- opencode-dcp: https://github.com/Tarquinen/opencode-dynamic-context-pruning
- opencode-skillful: https://github.com/zenobi-us/opencode-skillful
- opencode-mem: https://github.com/zhafron/opencode-mem
- opencode-vibeguard: https://github.com/inkdust2021/opencode-vibeguard
- opencode-deepseek-thinking-fix: https://github.com/lynnguo666/opencode-deepseek-thinking-fix
- opencode-shell-strategy: https://github.com/JRedeker/opencode-shell-strategy
- opencode-pty: https://github.com/shekohex/opencode-pty
- opencode-websearch-cited: https://github.com/ghoulr/opencode-websearch-cited
- opencode-subagent-statusline: https://github.com/joaquinvesapa/opencode-subagent-statusline
- Ecosystem: https://opencode.ai/docs/ecosystem/
- Config Schema: https://opencode.ai/config.json
- Windows WSL: https://opencode.ai/docs/windows-wsl
- OpenRouter Models: https://openrouter.ai/models
