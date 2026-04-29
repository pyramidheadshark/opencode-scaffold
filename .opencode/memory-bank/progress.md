# Progress

## Done
- [x] Исследована экосистема OpenCode (доки, плагины, агенты, скилы, конфиг)
- [x] Критический анализ: scaffold CLI избыточен, переходим на нативный OpenCode + плагины
- [x] WSL2 Ubuntu 24.04 — установлена и работает
- [x] Node.js 22 установлен через nvm в WSL
- [x] OpenCode установлен в WSL через curl
- [x] Создан `~/.config/opencode/opencode.json` с GLM 5.1 + DeepSeek V4 Flash
- [x] Создан `~/.config/opencode/AGENTS.md` с глобальными правилами + анти-враньё протокол
- [x] Создан `~/.config/opencode/prompts/build.txt` с промптом build-агента
- [x] Созданы 4 кастомных агента (qa-engineer, security-sentinel, performance-analyst, infra-provisioner)
- [x] Созданы 4 скила (fastapi-patterns, yc-infra, ml-pipeline, pre-commit)
- [x] Написан детальный план: `OPENCODE-PROD-SETUP-PLAN.md`
- [x] OPENROUTER_API_KEY добавлен в ~/.bashrc (дубль исправлен)
- [x] oh-my-opencode / Sisyphus — верифицирован, полностью работоспособен
- [x] Все 4 скила загружаются через skill tool
- [x] Добавлен Kimi K2.6 как deep-worker агент ($0.60/$2.80, SWE-Bench Pro 58.6%)
- [x] Аудит плагинов: выявлены P0/P1 гэпы, добавлены 6 новых плагинов
- [x] P0 плагины: opencode-command-hooks, setu-opencode, cc-safety-net
- [x] P1 плагины: opencode-injection-guard, block-no-verify, opencode-rules
- [x] Анти-враньё стратегия добавлена в AGENTS.md (верификация, антирегрессия, антимок)
- [x] Корневой AGENTS.md сгенерирован для claude-scaffold
- [x] Шаблон per-project opencode.json создан: src/templates/opencode-project.jsonc
- [x] Критический анализ scaffold CLI: 8 уникальных HIGH-value фич, остальные заменены плагинами

## In Progress
- [ ] /init-deep — генерация иерархических AGENTS.md (legacy_v1/, src/commands/ — делегировано)

## Next
- [ ] Перезапуск OpenCode для активации новых плагинов (12 вместо 6)
- [ ] Тест Kimi K2.6 как deep-worker на реальной задаче
- [ ] Создать per-project opencode.json для каждого TechCon репозитория
- [ ] Извлечь HIGH-value уникальные фичи scaffold как плагины/скилы:
  - AST RAG indexing → skill
  - Multi-repo sync → plugin
  - CCR management → plugin
  - Skill auto-activation hooks → plugin
  - Weekly quota tracking → plugin
