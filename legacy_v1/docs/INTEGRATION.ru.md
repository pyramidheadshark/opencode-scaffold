# Руководство по интеграции — claude-scaffold

## Что деплоится

После выполнения `deploy.sh` в целевой проект копируется:

```
your-project/
├── .claude/
│   ├── hooks/
│   │   ├── skill-activation-prompt.js   # UserPromptSubmit — инжектирует скиллы
│   │   ├── skill-activation-logic.js    # Тестируемая логика (без зависимостей)
│   │   ├── python-quality-check.sh      # PostToolUse — запускает ruff/mypy при редактировании
│   │   └── post-tool-use-tracker.sh     # PostToolUse — логирует использование инструментов
│   ├── agents/          # 8 специализированных под-агентов
│   ├── commands/        # 4 slash-команды (/new-project, /review и т.д.)
│   └── skills/          # только выбранные скиллы + skill-rules.json
└── dev/
    └── status.md        # контекстный файл сессии (заполнить перед первой сессией)
```

---

## Быстрый старт (5 шагов)

### Шаг 1 — Клонировать infra-репозиторий

```bash
git clone <claude-scaffold-url> ~/tools/claude-scaffold
cd ~/tools/claude-scaffold
npm install
```

### Шаг 2 — Запустить скрипт деплоя

```bash
# Минимальный Python/FastAPI проект
./scripts/deploy.sh ~/Repos/my-project \
  --skills python-project-standards,fastapi-patterns,test-first-patterns

# Полный ML-проект
./scripts/deploy.sh ~/Repos/my-project --all

# С тестовым набором (рекомендуется для команд)
./scripts/deploy.sh ~/Repos/my-project --all --with-tests

# Включить мета-скиллы (design-doc-creator, skill-developer)
./scripts/deploy.sh ~/Repos/my-project --all --include-meta
```

### Шаг 3 — Создать CLAUDE.md в целевом проекте

```bash
cp .claude/CLAUDE.md ~/Repos/my-project/.claude/CLAUDE.md
# Отредактировать: обновить название проекта, стек, цель деплоя
```

Или использовать команду в Claude Code после деплоя:
```
/init-design-doc
```

### Шаг 4 — Заполнить dev/status.md

Открыть `dev/status.md` и заполнить:
- **Business Goal** — одно предложение: что должен делать проект
- **Current Phase** — отметить активную фазу
- **Next Session Plan** — первые 3 действия для Claude

Этот файл загружается автоматически на каждый промпт.

### Шаг 5 — Проверить работу хука

Открыть Claude Code в целевом проекте и написать промпт с trigger-ключевым словом.
Например: `"How should I structure pyproject.toml?"` → должен инжектироваться `python-project-standards`.

---

## Выбор скиллов

| Тип проекта | Рекомендуемые скиллы |
|---|---|
| FastAPI REST API | `python-project-standards`, `fastapi-patterns`, `test-first-patterns` |
| ML-пайплайн | `python-project-standards`, `ml-data-handling`, `predictive-analytics` |
| RAG / LLM app | `fastapi-patterns`, `rag-vector-db`, `langgraph-patterns` |
| Полная ML-платформа | `--all` |
| Внутренний инструмент | `python-project-standards`, `fastapi-patterns`, `infra-yandex-cloud` |
| NLP / анонимизация | `python-project-standards`, `nlp-slm-patterns`, `test-first-patterns` |

---

## Мета-скиллы и флаг `--include-meta`

`design-doc-creator` и `skill-developer` помечены `"optional": true` в `skill-rules.json`.
Хук **никогда не загружает их автоматически**, даже при совпадении ключевых слов.
Это предотвращает лишний расход токенов.

Чтобы включить мета-скиллы при деплое:

```bash
./scripts/deploy.sh ~/Repos/my-project --all --include-meta
```

Без `--include-meta` скрипт исключает optional-скиллы из генерируемого `skill-rules.json`.

---

## Настройка после деплоя

### Отключить скилл

```bash
rm -rf .claude/skills/htmx-frontend
# Удалить блок "htmx-frontend" из skill-rules.json
```

### Добавить собственный скилл

```
.claude/skills/my-custom-skill/
├── SKILL.md               # обязательно
├── skill-metadata.json    # обязательно (version, updated, size_lines)
└── resources/             # опционально — подсекции для прогрессивного раскрытия
    └── topic.md
```

Добавить правило в `skill-rules.json`:

```json
{
  "skill": "my-custom-skill",
  "triggers": {
    "keywords": ["my-keyword"],
    "files": ["*.myext"]
  },
  "priority": 15
}
```

### Настроить `min_keyword_matches`

Некоторые скиллы требуют 2+ совпадений ключевых слов перед активацией:

| Скилл | Причина |
|---|---|
| `langgraph-patterns` | "graph", "node", "state" встречаются в нелангграфовых контекстах |
| `infra-yandex-cloud` | "docker", "container" встречаются в любых cloud-промптах |

Одно общее слово не активирует скилл. Два специфичных — активирует.

```json
"triggers": {
  "keywords": ["langgraph", "state", "graph", "node"],
  "min_keyword_matches": 2
}
```

### Изменить лимит скиллов

В `skill-rules.json`, параметр `context_management.max_skills_per_session`:

```json
"context_management": {
  "max_skills_per_session": 2
}
```

**Рекомендация**: держать 2–3. Более 3 скиллов = 5000+ токенов на каждый промпт.

---

## Бюджет токенов

Примерная стоимость на сессию при инжекции скиллов:

| Компонент | Токены |
|---|---|
| `dev/status.md` (типичный) | ~200 |
| Маленький скилл (<150 строк) | ~800–1 200 |
| Средний скилл (150–250 строк) | ~1 500–2 500 |
| Сжатый скилл (>300 строк) | ~600 (только заголовки) |
| 3 скилла, все средние | ~5 500–8 000 |

Токены появляются в начале каждого промпта через `system_prompt_addition`.
На контекстном окне 200K это < 5%. Приемлемо.

---

## Запуск тестов

```bash
# Jest тесты (логика хука + E2E)
npm run test:hook

# Python infra-тесты (структурные контракты)
python tests/infra/test_infra.py

# Все тесты
npm test
```

Ожидаемые результаты: 37+ Jest тестов, 31+ Python тестов.

---

## Troubleshooting

### Хук не активируется

1. Проверить `.claude/settings.json` — секция `hooks` должна быть включена
2. Убедиться, что `skill-activation-prompt.js` указан в `UserPromptSubmit`
3. Проверить вручную:
   ```bash
   echo '{"prompt":"pyproject.toml setup"}' | node .claude/hooks/skill-activation-prompt.js
   ```

### Скиллы не совпадают

Ключевые слова триггеров в `skill-rules.json` сопоставляются без учёта регистра.
Для скиллов с `min_keyword_matches: 2` нужно **минимум 2 совпадения**.

### Windows: хук падает с ошибкой stdin

Хук использует файловый дескриптор `0` (stdin) — это кроссплатформенно.
Если возникают ошибки: убедиться, что Node.js есть в PATH и терминал Claude Code настроен на Git Bash (не cmd/PowerShell).

### Windows: `npm run test:infra` не находит `python3`

Скрипт автоматически пробует `python3`, затем `python`. Если оба недоступны:

```bash
python tests/infra/test_infra.py
```
