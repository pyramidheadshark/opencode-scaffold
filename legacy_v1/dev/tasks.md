# Tasks — 2026-03-21

## Distribution (текущий приоритет)

> Весь контент для ручного постинга: `dev/posting-guide.html`

### Автоматизированные (Claude делает)
- [x] PR: filipecalegario/awesome-vibe-coding — https://github.com/filipecalegario/awesome-vibe-coding/pull/100
- [x] PR: jamesmurdza/awesome-ai-devtools — https://github.com/jamesmurdza/awesome-ai-devtools/pull/326
- [x] PR: thedaviddias/llms-txt-hub — https://github.com/thedaviddias/llms-txt-hub/pull/787
- [x] PR: ComposioHQ/awesome-claude-plugins — https://github.com/ComposioHQ/awesome-claude-plugins/pull/66
- [x] PR: rohitg00/awesome-claude-code-toolkit — https://github.com/rohitg00/awesome-claude-code-toolkit/pull/79
- [x] PR: Prat011/awesome-llm-skills — https://github.com/Prat011/awesome-llm-skills/pull/56

### Требуют действий от пользователя (по приоритету)
- [ ] **P0** Issue: hesreallyhim/awesome-claude-code — **только через github.com UI** (29k★). URL: https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml. Category: CLAUDE.md Files → Project Scaffolding & MCP
- [ ] **P0** GitHub Topics — repo Settings → Topics: `claude-code claude-md anthropic scaffold npx cli developer-tools ai-workflow hooks agents npm-package`
- [ ] **P1** Anthropic official form: clau.de/plugin-directory-submission
- [ ] **P1** Reddit post: r/ClaudeCode — контент в dev/posting-guide.html (постить в будни 9–11am EST, прикрепить docs/demo.gif)
- [ ] **P2** Reddit post: r/ClaudeAI — контент в dev/posting-guide.html
- [ ] **P2** Discord Anthropic #show-and-tell — личное сообщение + прикрепить docs/demo.gif
- [ ] **P2** Discord MLOps Community #share-your-work — ML-focused сообщение
- [ ] **P2** Telegram: @ai_machinelearning_big_data, @evocoders — RU пост
- [ ] **P3** DevHunt.org — регистрация продукта
- [ ] **P3** Uneed.best — регистрация продукта

## Demo GIF
- [x] docs/demo.gif — Catppuccin Mocha, VHS через yc-ctrl, WindowBar Colorful

## Технический долг
- [ ] phs_calorie_app: удалить .claude/ из git-истории (commit 359761f)
- [ ] Очистить deployed-repos.json от ~25 temp-записей + дублирующегося TechCon_Passports
- [ ] v1.4.0: safe artifact cleanup — удаление .sh хуков при update (hash-check, не трогать если изменён)
