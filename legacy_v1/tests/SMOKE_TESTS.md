# Manual Smoke Tests: Agents and Commands

Эти тесты нельзя автоматизировать — они проверяют качество LLM-поведения. Запускать при каждом значимом изменении агентов или CLAUDE.md.

---

## Легенда

- ✅ PASS — поведение корректное
- ❌ FAIL — нужен фикс агента/скилла
- ⚠️ PARTIAL — частично корректно, нужно уточнение

---

## Smoke Test 1: /init-design-doc

**Setup:** Новая пустая папка, никаких файлов.

**Промпт:** `/init-design-doc`

**Ожидаемое поведение:**
- [ ] Задаёт вопросы блоками (A, B, C, D), не все сразу
- [ ] После ответов создаёт `design-doc.md` в корне
- [ ] Создаёт `dev/status.md` с фазой Phase 1 Active
- [ ] Все секции 0–5 заполнены из ответов
- [ ] Секции 6–9 имеют TBD с объяснениями (не просто пустые)
- [ ] Вывел summary: кол-во открытых вопросов, следующий шаг
- [ ] НЕ начал писать код

**Критический провал:** начал писать код до утверждения дизайн-дока.

---

## Smoke Test 2: design-doc-architect

**Setup:** Папка с коротким описанием проекта в `brief.txt`.

**Промпт:** `Создай design-doc.md для проекта чат-бота для обучения сотрудников. Компания — производитель оборудования, 200 человек. Бот должен отвечать на вопросы по инструкциям и тестировать знания.`

**Ожидаемое поведение:**
- [ ] Загрузил `design-doc-creator` скилл (упомянул или видно по поведению)
- [ ] Задал уточняющие вопросы перед заполнением (не заполнил сразу)
- [ ] Открытые вопросы конкретные и однозначно отвечаемые
- [ ] Секция 4 (Scenarios) содержит ≥ 3 сценария в формате Given/When/Then
- [ ] NFR в секции 5 имеют измеримые значения или explicit TBD
- [ ] Указал пути к `.feature` файлам для каждого сценария

**Критический провал:** заполнил технические секции до разрешения бизнес-вопросов.

---

## Smoke Test 3: test-architect

**Setup:** Готовый `design-doc.md` со статусом APPROVED, 3 сценария в секции 4.

**Промпт:** `Запусти test-architect агент для текущего проекта`

**Ожидаемое поведение:**
- [ ] Прочитал `design-doc.md` секцию 4
- [ ] Создал `.feature` файлы в `tests/features/`
- [ ] Создал step definitions stubs в `tests/features/steps/`
- [ ] Создал unit test stubs в `tests/unit/`
- [ ] Все stubs помечены `@pytest.mark.xfail(reason="not implemented")`
- [ ] Выполнил `pytest --collect-only` и показал результат
- [ ] Обновил `dev/status.md`: Phase 1 → complete, Phase 2 → active
- [ ] НЕ начал писать код реализации

**Критический провал:** написал реализацию вместо stubs.

---

## Smoke Test 4: code-reviewer

**Setup:** Ветка с намеренно плохим кодом:
```python
@app.get("/users")
async def get_users():
    import psycopg2
    conn = psycopg2.connect("postgresql://localhost/db")
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE id = {request.args.get('id')}")
    return cursor.fetchall()
```

**Промпт:** `/review`

**Ожидаемое поведение:**
- [ ] Запустил `ruff check` и `mypy` перед ревью
- [ ] Нашёл: бизнес-логика в API слое
- [ ] Нашёл: SQL injection (f-string в запросе)
- [ ] Нашёл: прямой импорт psycopg2 без адаптера
- [ ] Нашёл: синхронный драйвер в async контексте
- [ ] Вывел структурированный отчёт по формату агента
- [ ] Разделил на Critical / Major / Minor

**Критический провал:** не нашёл SQL injection.

---

## Smoke Test 5: debug-assistant

**Setup:** Сломанный тест с трейсбеком:
```
FAILED tests/unit/test_service.py::test_create_item
RuntimeError: Task attached to a different loop
```

**Промпт:** `Помоги разобраться с этой ошибкой: RuntimeError: Task attached to a different loop`

**Ожидаемое поведение:**
- [ ] Классифицировал как async error
- [ ] Сформулировал гипотезу (не просто "попробуй это")
- [ ] Спросил или проверил `asyncio_mode` в pytest config
- [ ] Предложил конкретный фикс с объяснением root cause
- [ ] После фикса предложил запустить тест для верификации
- [ ] НЕ применил несколько фиксов одновременно

**Критический провал:** предложил `asyncio.get_event_loop().run_until_complete()` как решение.

---

## Smoke Test 6: project-status-reporter

**Setup:** Проект с 10+ коммитами, рабочими тестами, `dev/status.md`.

**Промпт:** `Сгенерируй статус-отчёт по проекту`

**Ожидаемое поведение:**
- [ ] Запустил `git log`, `pytest --cov`, `ruff check`
- [ ] Использовал реальные числа из команд (не выдумал)
- [ ] Отчёт сохранён в `dev/reports/{date}-status.md`
- [ ] Секция "Completed" основана на git log, не выдумана
- [ ] Секция "Risks" не пустая если есть открытые issues
- [ ] Тон фактический, без marketing language

**Критический провал:** выдумал метрики покрытия без запуска pytest.

---

## Smoke Test 7: Skill Activation

**Setup:** Проект с `dev/status.md`. Изменённый файл: `api/routers/chat.py`.

**Промпт:** `Добавь endpoint для потоковой передачи ответа чат-бота`

**Ожидаемое поведение:**
- [ ] `dev/status.md` инжектирован первым
- [ ] Активировался `fastapi-patterns` (файл в `api/`)
- [ ] Активировался `langgraph-patterns` (слово "чат-бот" / streaming)
- [ ] НЕ активировались нерелевантные скиллы (ml-data-handling, infra-yandex-cloud)
- [ ] Максимум 3 скилла суммарно

---

## Запуск всех автоматических тестов

```bash
python3 tests/infra/test_infra.py
npx jest tests/hook/ --no-coverage
```

Оба должны быть зелёными перед каждым релизом.
