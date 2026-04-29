<div align="center">

# 🏗️ opencode-scaffold

**Разверни мощную агентную среду для [OpenCode](https://opencode.ai) за секунды**

[![npm version](https://img.shields.io/npm/v/opencode-scaffold?color=blue&label=npm)](https://www.npmjs.com/package/opencode-scaffold)
[![license](https://img.shields.io/github/license/pyramidheadshark/opencode-scaffold)](LICENSE)
[![node](https://img.shields.io/node/v/opencode-scaffold?color=green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · Русский

</div>

---

## ✨ Возможности

### 🤖 Команда ИИ-агентов
Настраивает полную иерархию агентов — от оркестрирующего Архитектора до специализированных субагентов для тестирования, безопасности и анализа производительности. Каждый агент знает свою роль и работает автономно.

### 🧠 Персистентный банк памяти
Забудьте о потере контекста между сессиями. Банк памяти хранит брифы проектов, логи прогресса и активный контекст — ваши ИИ-агенты помнят, что вы делали вчера.

### 🔍 Автоопределение навыков
Определяет ваш технологический стек (Python, FastAPI, Node.js, React) и автоматически копирует релевантные навыки. Проект на FastAPI? Получите паттерны API. Python-репозиторий? Паттерны тестирования. Без конфигурации.

### 🔒 Pre-commit защита
Генерирует проверенные pre-commit хуки: ruff для линтинга, mypy для типов, eslint для JS, плюс тест-шлюз, запускающий pytest или npm test перед каждым коммитом.

### 📊 Сервер телеметрии
Встроенный OTLP-лиснер, сохраняющий трейсы в SQLite — see exactly как ваши агенты тратят контекстный бюджет и какие инструменты вызывают чаще всего.

### 🌳 AST-индексирование
Генерирует карту проекта на базе tree-sitter для RAG-индексирования LLM. Ваши ИИ-агенты получают структурное понимание кодовой базы, а не просто сырой текст.

---

## 🚀 Быстрый старт

```bash
# Одна команда — установка не нужна
npx opencode-scaffold init -y
```

Готово. Теперь в вашем проекте:

```
your-project/
├── .opencode/
│   ├── agents/              # 🤖 Конфиги агентов + промпты
│   │   ├── architect.md
│   │   ├── qa_engineer.md
│   │   ├── security_sentinel.md
│   │   ├── performance_analyst.md
│   │   └── prompts/
│   ├── memory-bank/         # 🧠 Персистентный контекст
│   │   ├── projectbrief.md
│   │   ├── activeContext.md
│   │   ├── progress.md
│   │   ├── systemContext.md
│   │   └── productContext.md
│   ├── skills/              # 🔍 Автоопределённые навыки
│   ├── config.json          # ⚙️ Конфиг проекта
│   └── OPENCODE.md          # 📋 Входной промпт
├── .pre-commit-config.yaml  # 🔒 Линт + тест-шлюзы
└── .opencode-scaffold.json  # 📦 Манифест
```

## 📋 Команды

| Команда | Описание |
|---------|----------|
| `opencode-scaffold init` | Интерактивное скаффолдинг (флаг `-y` для дефолтов) |
| `opencode-scaffold sync-skills` | Определить стек и синхронизировать навыки |
| `opencode-scaffold ast` | Сгенерировать AST-карту для RAG-индексирования |
| `opencode-scaffold telemetry` | Запустить OTLP → SQLite сервер телеметрии |

## 🤖 Сгенерированные агенты

| Агент | Роль | Режим | Описание |
|-------|------|-------|----------|
| 🏛️ Архитектор | Оркестратор | Primary | Главный агент — делегирует задачи, ведёт банк памяти |
| 🧪 QA-инженер | Тестирование | Subagent | E2E тесты, отчёты о дефектах, до 3 попыток |
| 🛡️ Security Sentinel | Безопасность | Subagent | Поиск уязвимостей, инъекции, supply chain |
| ⚡ Аналитик производительности | Оптимизация | Subagent | Big-O анализ, утечки памяти, N+1 запросы |

Агенты настроены для моделей [Z.AI Coding Plan](https://z.ai), но могут быть изменены через `.opencode/config.json`.

## 🔌 Экосистема плагинов

Сгенерированный конфиг включает курируемый набор плагинов:

| Категория | Плагины |
|-----------|---------|
| Оркестрация | [oh-my-openagent](https://github.com/nicepkg/oh-my-opencode), [opencode-skillful](https://github.com/nicepkg/opencode-skillful) |
| Контекст | [@tarquinen/opencode-dcp](https://github.com/Tarquinen/opencode-dcp), [opencode-mem](https://github.com/nicepkg/opencode-mem) |
| Качество | [opencode-vibeguard](https://github.com/nicepkg/opencode-vibeguard), [cc-safety-net](https://github.com/nicepkg/cc-safety-net) |
| Эффективность | [opencode-tool-search](https://github.com/nicepkg/opencode-tool-search), [opencode-lazy-loader](https://github.com/nicepkg/opencode-lazy-loader) |
| Управление | [opencode-rules](https://github.com/nicepkg/opencode-rules), [opencode-command-hooks](https://github.com/nicepkg/opencode-command-hooks) |
| MCP-серверы | Web Search, Web Reader, GitHub Knowledge (zread), SQLite |

## 🛠️ Разработка

```bash
git clone https://github.com/pyramidheadshark/opencode-scaffold.git
cd opencode-scaffold
npm install
npm run build      # tsup → dist/index.js
npm test           # vitest run tests/e2e/
npx tsc --noEmit   # проверка типов
```

## 📦 Публикация

```bash
npm run build
npm version patch        # или minor, major
npm publish --access public
```

## 📝 Зависимости и атрибуция

| Библиотека | Назначение | Автор | Лицензия |
|-----------|------------|-------|----------|
| [commander](https://github.com/tj/commander.js) | CLI-фреймворк | [@tj](https://github.com/tj) | MIT |
| [inquirer](https://github.com/SBoudrias/Inquirer.js) | Интерактивные промпты | [@SBoudrias](https://github.com/SBoudrias) | MIT |
| [chalk](https://github.com/chalk/chalk) | Стилизация терминала | [@chalk](https://github.com/chalk) | MIT |
| [express](https://github.com/expressjs/express) | HTTP-сервер телеметрии | [Express.js](https://github.com/expressjs) | MIT |
| [sqlite3](https://github.com/TryGhost/node-sqlite3) | Хранилище телеметрии | [Ghost Foundation](https://github.com/TryGhost) | BSD-3-Clause |
| [tsup](https://github.com/egoist/tsup) | Сборщик | [@egoist](https://github.com/egoist) | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Система типов | [Microsoft](https://github.com/microsoft) | Apache-2.0 |
| [vitest](https://github.com/vitest-dev/vitest) | Тестовый фреймворк | [@sheremet-va](https://github.com/sheremet-va) | MIT |
| [execa](https://github.com/sindresorhus/execa) | Выполнение процессов | [@sindresorhus](https://github.com/sindresorhus) | MIT |

## Лицензия

[MIT](LICENSE) © pyramidheadshark
