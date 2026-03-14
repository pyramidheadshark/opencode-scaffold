**claude-scaffold**

**PROJECT STATUS DASHBOARD**

Документ для переноса контекста в новый чат

Дата: 2026-03-02 · Текущая версия: v0.5.0 · Статус: ACTIVE DEVELOPMENT

**Все тесты: 27 Python ✓ + 24 Jest ✓ = 51/51 зелёных**

**1. Что мы строим и зачем**

Мы строим персональную инфраструктуру Claude Code для ML-инженера. Это
не приложение и не проект --- это шаблонная система, которая
устанавливается один раз и копируется в каждый новый рабочий проект.

**Основная идея**

**Проблема:** Claude Code без настройки --- это умный ассистент с
провалами памяти. Он не помнит ваши стандарты кода между сессиями, не
знает ваш стек, не следует вашей архитектуре, не понимает где находится
проект.

**Решение:** инфраструктура из трёх механизмов:

- **Скиллы (Skills):** Markdown-файлы с паттернами кода, которые
  автоматически инжектируются в контекст Claude Code при релевантном
  промпте. Скилл по FastAPI загружается только когда ты работаешь с
  роутерами --- не раньше.

- **Агенты (Agents):** Специализированные субагенты с фокусированными
  инструкциями. design-doc-architect создаёт документацию,
  test-architect пишет тесты, debug-assistant разбирает стектрейсы.

- **Хуки (Hooks):** JavaScript/Bash скрипты, срабатывающие на события
  Claude Code (UserPromptSubmit, Stop). Главный хук читает промпт,
  матчит его с базой скиллов и автоматически добавляет нужные паттерны в
  системный промпт.

**Целевой пользователь**

Один ML-инженер (или малая команда 1--3 человека), работающий на
Python/FastAPI/LangGraph стеке, деплоящий в Yandex Cloud, использующий
Claude Code как основной инструмент разработки.

**Конечная цель**

После установки инфры: открываешь новый проект, пишешь /init-design-doc
--- Claude задаёт правильные вопросы, создаёт design-doc.md,
инициализирует dev/status.md. Дальше каждый промпт автоматически
получает нужный контекст без ручного копирования правил. Код
соответствует стандартам без напоминаний.

**2. Текущее состояние репозитория (v0.5.0)**

> **Статус:** инфраструктура построена, все тесты зелёные. Готова к
> реальному использованию в проектах.

**2.1 Скиллы (13 штук)**

  -------------------------- ----------- --------------------------- -----------------------
  **Скилл**                  **Строк**   **Ресурсы**                 **Триггеры (примеры)**

  python-project-standards   160         gitignore.md,               pyproject.toml, .py
                                         pre-commit-config.md        files

  fastapi-patterns           163         background-tasks.md,        routers/, api/,
                                         dependency-injection.md,    services/
                                         middleware.md               

  htmx-frontend              182         ---                         Jinja2, templates/,
                                                                     HTMX

  ml-data-handling           211         dvc-alternative.md,         pickle, ONNX, Parquet,
                                         feature-store.md            S3

  multimodal-router          134         ---                         PDF, DOCX, XLSX, MP4

  langgraph-patterns         239         streaming.md,               LangGraph, agent, graph
                                         testing-agents.md,          
                                         multi-agent.md              

  rag-vector-db              311 ⚠       reranking.md, eval-ragas.md Qdrant, pgvector,
                                                                     embedding, RAG

  nlp-slm-patterns           236         spacy-ner.md,               Presidio, spaCy,
                                         model-quantization.md       Ollama, vLLM

  predictive-analytics       240         hyperparameter-tuning.md,   sklearn, MLflow, Optuna
                                         feature-importance.md       

  infra-yandex-cloud         247         cloud-init.md,              Terraform, Packer,
                                         github-actions-deploy.md    Helm, YC

  test-first-patterns        143         ---                         tests/, conftest.py,
                                                                     .feature

  design-doc-creator         86          ---                         New project,
                                                                     design-doc.md

  skill-developer            117         ---                         .claude/skills/,
                                                                     skill-rules.json
  -------------------------- ----------- --------------------------- -----------------------

> ⚠ rag-vector-db/SKILL.md = 311 строк, превышает порог компрессии 300.
> Загружается в сжатом виде --- Claude видит только первые 50 строк +
> заголовки. Нужно вынести pgvector-секцию в resources/pgvector.md.

**2.2 Агенты (8 штук)**

  ------------------------- ------------------------- ------------------------------
  **Агент**                 **Назначение**            **Ключевые выходы**

  design-doc-architect      Создаёт design-doc.md из  Заполненный шаблон, список
                            требований                открытых вопросов

  test-architect            Генерирует скелет тестов  .feature файлы, step
                            из design-doc             definitions, unit stubs

  multimodal-analyzer       Извлекает данные из PDF,  Структурированный
                            DOCX, XLSX, видео         JSON/Markdown

  code-reviewer             Ревью на архитектурную    Отчёт Critical/Major/Minor
                            согласованность           

  infra-provisioner         Пишет Terraform, Packer,  Готовые infra/\*.tf файлы
                            Docker Compose            

  refactor-planner          Планирует пошаговый       Пронумерованный план с
                            рефакторинг               обоснованиями

  project-status-reporter   Генерирует статус из      dev/reports/{date}-status.md
                            git + coverage            

  debug-assistant           Диагностирует ошибки по   Гипотеза + конкретный фикс
                            стектрейсу                
  ------------------------- ------------------------- ------------------------------

**2.3 Команды (4 штуки)**

  ------------------ -----------------------------------------------------
  **Команда**        **Что делает**

  /init-design-doc   Интерактивный визард: задаёт вопросы блоками A/B/C/D,
                     создаёт design-doc.md и dev/status.md

  /new-project       Инициализирует структуру проекта из шаблона (папки,
                     файлы, git)

  /review            Запускает code-reviewer агент на изменённых файлах

  /dev-status        Обновляет dev/status.md перед завершением сессии
  ------------------ -----------------------------------------------------

**2.4 Хуки (3 штуки)**

  ---------------------------- ------------------ ------------------------- --------------
  **Файл**                     **Событие**        **Что делает**            **Статус**

  skill-activation-prompt.js   UserPromptSubmit   Матчит промпт с           ✓ Работает
                                                  skill-rules.json,         
                                                  инжектирует скиллы +      
                                                  status.md в контекст      

  python-quality-check.sh      Stop               Запускает ruff + mypy при ✓ Работает
                                                  наличии pyproject.toml    

  post-tool-use-tracker.sh     PostToolUse        Пишет jsonl-лог каждого   ⚠ Лог нигде не
                                                  tool call                 используется
  ---------------------------- ------------------ ------------------------- --------------

**2.5 Шаблоны (10 файлов)**

- pyproject.toml --- полная конфигурация ruff, mypy, pytest, coverage

- .env.example --- переменные окружения (без реальных секретов)

- Makefile --- цели: install, lint, test, docker-up, docker-down

- Dockerfile --- multi-stage build (builder + runtime)

- docker-compose.yml --- базовый стек: app + postgres + redis

- design-doc.md --- шаблон документа с секциями 0--9

- status.md --- шаблон статус-файла сессии

- github/workflows/lint.yml, test.yml, build.yml --- GitHub Actions
  CI/CD

**2.6 Тесты**

  -------------- ------------------------------------- ------------ --------------------
  **Набор**      **Файл**                              **Тестов**   **Статус**

  Jest unit      tests/hook/skill-activation.test.js   24           27/27 ✓

  Python         tests/infra/test_infra.py             27           24/24 ✓
  structural                                                        

  Manual smoke   tests/SMOKE_TESTS.md                  7 сценариев  Ручные
  -------------- ------------------------------------- ------------ --------------------

Запуск: npx jest tests/hook/ \--no-coverage && python3
tests/infra/test_infra.py

**2.7 Документация**

- docs/ARCHITECTURE.md --- 10 ADR (Architecture Decision Records)

- docs/CHANGELOG.md --- история версий v0.1.0 → v0.5.0

- README.md --- обзор + VS Code extensions

- tests/SMOKE_TESTS.md --- 7 ручных сценариев для агентов

**3. История версий**

  ------------ ------------ -----------------------------------------------------
  **Версия**   **Дата**     **Что добавлено**

  v0.1.0       2026-03-02   CLAUDE.md, 4 скилла (python-project-standards,
                            fastapi-patterns, multimodal-router,
                            test-first-patterns), skill-activation-prompt.js хук,
                            2 агента, /dev-status команда, базовые шаблоны

  v0.2.0       2026-03-02   6 скиллов (ml-data-handling, htmx-frontend,
                            langgraph-patterns, infra-yandex-cloud,
                            design-doc-creator, skill-developer), 4 агента,
                            /new-project + /review команды,
                            post-tool-use-tracker.sh

  v0.3.0       2026-03-02   2 скилла (nlp-slm-patterns, predictive-analytics), 5
                            resources, 2 агента (project-status-reporter,
                            debug-assistant), 3 шаблона (pyproject.toml,
                            .env.example, Makefile)

  v0.4.0       2026-03-02   Скилл rag-vector-db (Qdrant, pgvector, embeddings,
                            chunking, RAG, RAGAS), /init-design-doc
                            команда-визард, ARCHITECTURE.md с 10 ADR,
                            feature-store.md

  v0.5.0       2026-03-02   51 автоматический тест (24 Jest + 27 Python),
                            skill-activation-logic.js (рефакторинг хука для
                            тестируемости), background-tasks.md, 7 smoke-тест
                            сценариев. Исправлено 3 реальных бага найденных
                            тестами
  ------------ ------------ -----------------------------------------------------

**4. Ключевые архитектурные решения**

Все решения зафиксированы в docs/ARCHITECTURE.md. Здесь --- краткая
сводка:

  --------- ---------------------- ------------------------------------------
  **ADR**   **Решение**            **Почему**

  ADR-001   Hexagonal Architecture Предотвращает утечку ML-логики в
            (Ports & Adapters) во  инфраструктурный код; core/ тестируется
            всех проектах          без инфраструктуры

  ADR-002   uv вместо              Rust-based resolver = на порядок быстрее;
            pip/poetry/conda       lockfile из коробки; нативный
                                   pyproject.toml

  ADR-003   Claude Sonnet (код) +  Автоматическая эскалация =
            Gemini Flash           недетерминированное поведение; Gemini
            (мультимодальное),     Flash в разы дешевле для PDF/видео
            роутинг явный          

  ADR-004   Manifest-файлы с       DVC = overhead для команды 1--3 чел.;
            SHA256 вместо DVC      manifest даёт 80% пользы за 20% усилий

  ADR-005   pytest-bdd поверх      BDD: design-doc сценарий → .feature → step
            чистого TDD            definitions = прямая трассируемость
                                   требований

  ADR-006   LangGraph вместо       Low-code = нет code review, нет
            n8n/Flowise/Langflow   тестирования, vendor lock-in; LangGraph
                                   --- это Python-код

  ADR-007   Qdrant (дефолт) +      Qdrant: лучше производительность при \>
            pgvector (если уже     100k векторов, лучше filtering
            есть PostgreSQL)       

  ADR-008   Единый dev/status.md   Множество per-task файлов = навигационная
            как источник состояния проблема; один файл = всегда актуальный,
                                   всегда первый

  ADR-009   Порог сжатия скиллов = Три полных скилла по 200 строк = 600 строк
            300 строк              контекста --- приемлемо; 500-строчные
                                   скиллы = слишком жирно

  ADR-010   MLflow self-hosted     SaaS = цена за seat + vendor lock-in;
            вместо W&B/Neptune     MLflow на том же YC VM, данные остаются у
                                   нас
  --------- ---------------------- ------------------------------------------

**5. Принципы взаимодействия с Claude Code**

Это критически важно для нового чата --- ты должен вести себя именно
так:

**Роль и стиль**

- Ты --- ведущий ML-инженер, не исполнитель. Думаешь на несколько шагов
  вперёд.

- Критическое мышление: оспариваешь идеи (включая собственные
  предложения) если видишь лучшее решение. Объясняешь ПОЧЕМУ
  альтернатива лучше.

- Системный подход: каждое изменение оцениваешь в контексте всей инфры
  --- как оно влияет на производительность, стоимость, поддержку,
  расширяемость.

- Итеративность: сложные задачи декомпозируешь на шаги, движемся
  пошагово.

- Код без комментариев внутри блоков --- все объяснения до или после
  блока.

**Техстек (неизменный)**

- Python + uv, FastAPI, Docker, Packer + Terraform (Yandex Cloud)

- Ruff + MyPy + pre-commit, pytest + pytest-bdd

- HTMX + Jinja2 для фронтенда, LangGraph для агентных пайплайнов

- Conventional Commits (английский), GitHub Actions

- **Модели:** claude-sonnet-4-6 для кода; google/gemini-3-flash-preview
  через OpenRouter для мультимодального

**Порядок разработки**

1.  Design document FIRST --- бизнес-логика пишется человеком,
    технические секции агентом

2.  BDD сценарии (.feature файлы) SECOND --- из design-doc

3.  Unit тесты с TDD (Red-Green-Refactor) THIRD

4.  Код LAST --- чтобы тесты стали зелёными

> **Никогда:** не начинать кодить до того, как design-doc.md существует
> и одобрен.

**6. Известные проблемы и технический долг**

**P1 --- Критические (мешают работе)**

**Относительный путь к хуку в settings.json**

Текущее: \"node .claude/hooks/skill-activation-prompt.js\"

Проблема: хук не находит файл если claude запущен не из корня проекта.

Исправление: \"node
\$CLAUDE_PROJECT_DIR/.claude/hooks/skill-activation-prompt.js\"

**P2 --- Важные (ухудшают качество)**

**rag-vector-db/SKILL.md = 311 строк (превышает порог 300)**

Следствие: SKILL.md сжимается при загрузке --- Claude видит только
первые 50 строк + список заголовков. Полного контента pgvector-секции
нет. **Решение:** вынести pgvector-секцию (\~40 строк) в
resources/pgvector.md

**post-tool-use-tracker.sh --- overhead без пользы**

Хук пишет jsonl-лог при каждом tool call. Лог нигде не читается и не
используется --- ни project-status-reporterом, ни другими агентами.
**Решение:** отключить PostToolUse в settings.json (закомментировать) до
интеграции в отчёты.

**Инвентарные таблицы в CLAUDE.md --- дублирование**

\~40 строк таблиц скиллов/агентов/команд добавляются в контекст каждой
сессии. Claude Code видит агентов и команды сам по своим файлам.
**Решение:** убрать таблицы из CLAUDE.md, документация для человека
живёт в docs/ARCHITECTURE.md.

**infra-provisioner vs /new-project --- нечёткое разграничение**

**Решение:** /new-project = всё с нуля (структура + инфра);
infra-provisioner = только Terraform/Helm для уже существующего проекта
где инфра меняется.

**P3 --- Тестирование: что не покрыто**

- Качество содержимого скиллов --- паттерны могут быть устаревшими

- Семантика Python кода в скиллах --- ast.parse() = только синтаксис

- Реальное поведение хука в Claude Code --- интеграционного теста нет

- Качество выходного контента агентов --- требует LLM evaluation
  pipeline

- Актуальность версий библиотек в скиллах (LangGraph API мог измениться)

**7. Дальнейшие шаги**

**Следующая сессия --- исправления P1 и P2**

Эти задачи логически завершают v0.5.0 перед переходом к v0.6.0:

5.  **Исправить settings.json:** заменить относительный путь на
    \$CLAUDE_PROJECT_DIR во всех трёх хуках

6.  **Вынести pgvector:** rag-vector-db/SKILL.md → pgvector-секция в
    resources/pgvector.md (SKILL.md станет \~270 строк)

7.  **Отключить PostToolUse:** закомментировать post-tool-use-tracker.sh
    в settings.json

8.  **Убрать инвентарные таблицы:** удалить Skill Inventory / Agent
    Inventory / Command Inventory секции из CLAUDE.md

9.  **Запустить тесты:** проверить что всё по-прежнему зелёное после
    изменений

**v0.6.0 --- Реальный smoke-тест инфры**

Создать тестовый проект с нуля используя инфру и пройти полный цикл:

10. **Шаг 1:** /init-design-doc на реальном задании (например, простой
    RAG-чатбот)

11. **Шаг 2:** Запустить test-architect на созданном design-doc

12. **Шаг 3:** Реализовать первый компонент следуя TDD

13. **Шаг 4:** Запустить /review на написанном коде

14. **Шаг 5:** project-status-reporter → проверить что отчёт корректный

15. **Шаг 6:** Зафиксировать что работает, что нет, обновить скиллы по
    итогам

**v0.7.0 --- Расширение скиллов по результатам реального использования**

- Добавить integration tests: реальный git diff в file-based matching

- SessionStart хук: загружать git status + TODO при старте (вместо
  UserPromptSubmit)

- Рассмотреть skill для работы с PostgreSQL/SQLAlchemy (очень частая
  задача в ML)

- Рассмотреть skill для Celery/ARQ (уже есть background-tasks.md,
  возможно нужен полный скилл)

- LLM-based качество скиллов: оценить паттерны на реальных задачах

**Потенциальные идеи для обсуждения**

> **Идея:** Makefile с командой make infra-update --- автоматическая
> синхронизация .claude/ из \~/dev/claude-scaffold/ во все проекты.
> Сейчас обновление инфры требует ручного cp -r.
>
> **Идея:** Скилл для работы с Alembic миграциями --- частая боль в ML
> проектах где схема БД активно меняется.
>
> **Идея:** Скилл для Prometheus + Grafana мониторинга --- стандартный
> стек для ML сервисов в проде.

**8. Как начать новый чат**

Скопируй этот блок как первое сообщение в новый чат:

> Мы продолжаем работу над claude-scaffold --- персональной
> инфраструктурой Claude Code для ML-инженера.
>
> Репозиторий: \~/dev/claude-scaffold/ \| Текущая версия: v0.5.0
>
> Полный статус в прикреплённом документе status-dashboard.docx.
>
> Принципы взаимодействия: ты --- ведущий ML-инженер с критическим
> мышлением, код без комментариев внутри блоков, итеративная
> декомпозиция задач.
>
> *Начинаем с: \[вставь задачу --- например, \'исправить settings.json
> пути к хукам\' или \'создать тестовый проект для smoke-теста
> инфры\'\]*

**Ключевой контекст для быстрого старта**

Если не прикреплять весь документ, то минимальный контекст:

- Инфра = скиллы + агенты + хуки для Claude Code. Не приложение.

- Стек: Python/FastAPI/LangGraph/Qdrant, деплой в Yandex Cloud, uv для
  зависимостей

- Архитектура проектов: Hexagonal (core/ не знает ни FastAPI, ни БД)

- Разработка: design-doc → BDD → TDD → код (в этом порядке, не иначе)

- dev/status.md --- всегда загружается первым в каждую сессию

- Тесты: 27 Python + 24 Jest = 51 тест, все зелёные

- Открытая проблема P1: settings.json использует относительный путь к
  хуку

claude-scaffold v0.5.0 · Project Status Dashboard · 2026-03-02
