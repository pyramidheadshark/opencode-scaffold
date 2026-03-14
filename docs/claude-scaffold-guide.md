**claude-scaffold**

Руководство по холодному старту, тестированию и подключению к Claude
Code

v0.5.0

**1. Холодный старт: от zip до рабочего проекта**

Репозиторий --- не приложение. Это инфраструктура для Claude Code:
скиллы, агенты, хуки, шаблоны. Сам по себе он ничего не запускает.
Установите один раз, затем копируйте .claude/ в каждый новый проект.

**Предварительные требования**

- npm install -g \@anthropic-ai/claude-code --- Claude Code установлен

- Node.js ≥ 18 (проверить: node \--version)

- Python ≥ 3.11

- uv: pip install uv \--break-system-packages

- Git инициализирован в проекте (важно для file-based matching в хуках)

**Шаг 1 --- Разместить инфраструктуру**

Распакуйте архив. Разместите папку постоянно --- это шаблон, а не
проект:

> mv claude-scaffold \~/dev/claude-scaffold

**Шаг 2 --- Создать структуру нового проекта**

> PROJECT=my-project
>
> mkdir -p
> \$PROJECT/{src/my_project/{api/routers,core,services,adapters,models},tests/{unit,integration,features/steps},dev,infra,.github/workflows}
>
> cd \$PROJECT && git init
>
> cp -r \~/dev/claude-scaffold/.claude/ .claude/
>
> cp \~/dev/claude-scaffold/templates/pyproject.toml .
>
> cp \~/dev/claude-scaffold/templates/.env.example .
>
> cp \~/dev/claude-scaffold/templates/Makefile .
>
> cp \~/dev/claude-scaffold/templates/Dockerfile .
>
> cp \~/dev/claude-scaffold/templates/docker-compose.yml .
>
> cp \~/dev/claude-scaffold/templates/design-doc.md .
>
> cp \~/dev/claude-scaffold/templates/status.md dev/
>
> cp -r \~/dev/claude-scaffold/templates/github/ .github/

**Шаг 3 --- Инициализировать Python-окружение**

> **Перед uv sync:** откройте pyproject.toml и замените project-name на
> реальное имя проекта во всех вхождениях.
>
> uv sync \--dev
>
> uv run pre-commit install

**Шаг 4 --- Первый коммит**

Хук читает git diff \--name-only HEAD. Без хотя бы одного коммита
file-based matching скиллов не работает:

> git add -A && git commit -m \'chore: init project structure\'

**Шаг 5 --- Запустить и проверить**

> claude \# запускать строго из корня проекта

Проверить хук вручную (из корня проекта):

> echo \'{\"prompt\": \"настроить pyproject.toml\"}\' \| node
> .claude/hooks/skill-activation-prompt.js
>
> Ожидаемый ответ содержит \"system_prompt_addition\" с содержимым
> скилла python-project-standards.

**2. Подключение хуков к Claude Code**

**Как это работает**

Claude Code читает .claude/settings.json при старте. При каждом промпте
срабатывает **UserPromptSubmit** --- хук получает JSON через stdin и
возвращает system_prompt_addition который Claude видит в контексте.

**Три уровня конфигурации**

  ----------------------------- ------------------ ------------------------------
  **Файл**                      **Область**        **Рекомендация**

  \~/.claude/settings.json      Все проекты        Только если хук нужен везде
                                (глобально)        

  .claude/settings.json         Текущий проект (в  Основное место для хуков
                                git)               

  .claude/settings.local.json   Локально, не в git Личные эксперименты
  ----------------------------- ------------------ ------------------------------

**Критический баг в нашей конфигурации**

> **Наш settings.json:** \"node
> .claude/hooks/skill-activation-prompt.js\" --- относительный путь. Хук
> молча не найдёт файл если claude запущен не из корня проекта.

**Исправление --- используйте** \$CLAUDE_PROJECT_DIR:

> \"command\": \"node
> \$CLAUDE_PROJECT_DIR/.claude/hooks/skill-activation-prompt.js\"
>
> \$CLAUDE_PROJECT_DIR --- переменная среды, которую Claude Code
> устанавливает автоматически. Она всегда указывает на корень проекта.
> Это рекомендованный паттерн из официальной документации.

**Актуальные события хуков**

  ------------------ ------------------ -------------- ----------------------------
  **Событие**        **Когда            **Matcher?**   **Наш хук**
                     срабатывает**                     

  UserPromptSubmit   Перед каждым       Нет            skill-activation-prompt.js ✓
                     промптом                          

  Stop               Когда Claude       Нет            python-quality-check.sh ✓
                     завершает ответ                   

  PostToolUse        После tool call    Да (tool_name) post-tool-use-tracker.sh ⚠

  PreToolUse         Перед tool call    Да             не используется

  SessionStart       При старте сессии  Нет            не используется
  ------------------ ------------------ -------------- ----------------------------

> **⚠ PostToolUse:** в Claude Code (август--октябрь 2025) есть баг ---
> PostToolUse иногда не срабатывает. Stop и UserPromptSubmit работают
> стабильно.

**Проверка подключения**

Внутри сессии Claude Code введите /hooks. Должен показать ваши хуки.

> Изменения в settings.json вступают в силу только после перезапуска
> claude --- снапшот хуков берётся при старте сессии.

**Troubleshooting**

  -------------------- --------------------------- ------------------------------
  **Симптом**          **Вероятная причина**       **Решение**

  /hooks показывает    claude запущен не из корня  Запускайте claude строго из
  пустой список                                    папки где .claude/

  Скилл не             keyword не матчится         Запустите хук вручную,
  активируется                                     проверьте JSON вывод

  Cannot find module   skill-activation-logic.js   Проверьте что оба JS файла в
                       отсутствует                 .claude/hooks/

  Хук не работает из   Относительный путь в        Замените на
  поддиректории        settings.json               \$CLAUDE_PROJECT_DIR/\...

  git diff возвращает  Нет ни одного коммита       git commit \--allow-empty -m
  пустоту                                          \'init\'
  -------------------- --------------------------- ------------------------------

**3. Тестирование: как запускать и интерпретировать**

**Два набора автоматических тестов**

  ----------------- ------------------------------------- -------------------- -----------
  **Набор**         **Файл**                              **Что проверяет**    **Время**

  JS Unit (Jest, 24 tests/hook/skill-activation.test.js   Логика хука:         \< 2 сек
  теста)                                                  matching, сжатие,    
                                                          output               

  Python Structural tests/infra/test_infra.py             Целостность файлов   \< 1 сек
  (27 тестов)                                             инфры                
  ----------------- ------------------------------------- -------------------- -----------

**Запуск**

> \# Один раз установить Jest
>
> npm install \--save-dev jest
>
> \# Оба набора
>
> npx jest tests/hook/ \--no-coverage && python3
> tests/infra/test_infra.py

**Как читать Python вывод**

Всё хорошо:

> test_all_agents_have_required_sections \... ok
>
> Ran 27 tests in 0.094s \| OK

При падении:

> test_skill_md_files_reference_existing_resources
> (skill=\'fastapi-patterns\') \... FAIL
>
> AssertionError: SKILL.md references missing resource:
> resources/background-tasks.md

  ------------ ------------------------- ------------------------------------
  **Статус**   **Значение**              **Что делать**

  ok           Тест прошёл               Ничего

  FAIL         Проблема в инфре          Читайте AssertionError --- там
                                         точная причина

  ERROR        Тест упал до проверки     Читайте Traceback --- обычно
                                         неверный путь
  ------------ ------------------------- ------------------------------------

> **Правило:** оба набора зелёные → можно применять изменения. Хотя бы
> один красный → сначала разберитесь.

**4. Критика: что тесты реально покрывают**

**Покрыто хорошо**

  ------------------------------------------- ---------------------------
  **Что тестируется**                         **Оценка**

  Keyword matching --- все ветки кода         ★★★★★

  Сжатие скиллов \> порога + заголовки в      ★★★★★
  выводе                                      

  buildOutput при пустых и непустых           ★★★★★
  injections                                  

  Все скиллы в skill-rules.json имеют         ★★★★★
  SKILL.md                                    

  Ссылки resources/ на существующие файлы     ★★★★★ (нашло 3 реальных
                                              бага)

  Python блоки синтаксически валидны          ★★★★☆

  Все шаблоны существуют и имеют нужные       ★★★★☆
  секции                                      

  .env.example не содержит секретов (regex)   ★★★☆☆
  ------------------------------------------- ---------------------------

**Что НЕ покрыто --- честно**

- **Качество содержимого скиллов.** Тест проверяет наличие \'When to
  Load\', не корректность паттернов.

- **Семантику Python кода.** ast.parse() = синтаксис. Неправильные
  импорты или несуществующие методы API не поймаются.

- **Реальное поведение хука в Claude Code.** Unit тесты --- mock fs.
  Интеграционного теста с реальным stdin нет.

- **Качество контента агентов.** Требует LLM evaluation pipeline ---
  отдельная дорогая задача.

- **Актуальность версий библиотек в скиллах.** Если LangGraph изменил
  API --- тесты не заметят.

- **Реальный git diff в file-based matching.** В тестах changedFiles ---
  просто массив строк.

> Итог: 51 тест = структурная целостность + логика роутинга. Ценно ---
> три реальных бага найдены именно тестами. Но ручные smoke-тесты из
> tests/SMOKE_TESTS.md обязательны.

**5. Критика: что сделано тяжелее чем нужно**

**rag-vector-db/SKILL.md --- 311 строк, сразу сжимается**

Превышает порог компрессии (300 строк) --- Claude видит только первые 50
строк. Вынесите pgvector-секцию в resources/pgvector.md, SKILL.md станет
\~270 строк и загрузится полностью.

**post-tool-use-tracker.sh --- I/O при каждом tool call без цели**

Пишет jsonl-лог который нигде не читается. Чистый overhead. Отключите
PostToolUse в settings.json пока tracker не интегрирован в
project-status-reporter.

**Инвентарные таблицы в CLAUDE.md --- дублирование**

\~40 строк таблиц скиллов/агентов/команд добавляются в каждую сессию.
Claude Code видит агентов сам по файлам. Документация для человека →
docs/ARCHITECTURE.md.

**infra-provisioner vs /new-project --- нечёткое разграничение**

Явное разграничение: /new-project = всё с нуля, infra-provisioner =
только Terraform/Helm для существующего проекта.

**Три конкретных действия (приоритет)**

1.  Вынести pgvector из rag-vector-db/SKILL.md в resources/pgvector.md

2.  Отключить PostToolUse в settings.json (закомментировать) до
    интеграции tracker

3.  Убрать инвентарные таблицы из CLAUDE.md

**Что не является проблемой**

- 13 скиллов при лимите 3 --- норма, большинство сессий активируют 1--2

- Рефакторинг хука на logic.js + prompt.js --- правильное решение для
  тестируемости

- 511 строк тестов --- страховка, не overhead

claude-scaffold v0.5.0 · Внутренняя документация
