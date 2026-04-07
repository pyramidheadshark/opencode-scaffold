# Project Status

> **IMPORTANT**: This file is loaded at the start of every Claude Code session.
> Keep it accurate. Update it before ending any session.
> This is the single source of truth for project state.

---

## Business Goal

Personal Claude Code infrastructure for ML engineering projects — reusable skills, hooks, agents, and templates that enforce the hexagonal architecture + TDD workflow across all Python/FastAPI projects.

---

## Current Phase

**Active**: v2.1.0 — Token Optimization (2026-04-08)

Branch: `feature/token-optimization`. Phase 1-4 complete, Phase 5 next.
Context: community data shows 3-4x token increase after Claude Code switched to 1M context (March 2026).
Goal: benchmark-driven optimization with Anthropic SDK, infographic output.

---

## Current State (2026-04-08)

- **v1.6.0 PUBLISHED** npm@1.6.0, main HEAD at `a8b4e68`
- **v2.0.0 code complete** on main — publish only by explicit command
- **v2.1.0 IN PROGRESS** on `feature/token-optimization`
- **522 tests** (465 Jest + 57 Python), 0 failed
- **4 GitHub stars**, 0 forks

### v2.1.0 Phase Progress:

| Phase | Status | Commit | Summary |
|---|---|---|---|
| Phase 1 — Context defaults | ✅ Done | f1b47db | `deploySettings()` now sets `DISABLE_1M_CONTEXT=1` + `showClearContextOnPlanAccept:true` as one-time defaults |
| Phase 2 — Compact signal redesign | ✅ Done | f1b47db | ExitPlanMode → /compact request before Step 1; threshold one-shot (default 40), configurable via `SCAFFOLD_COMPACT_THRESHOLD` |
| Phase 3 — Bash output filter | ✅ Done | 86fbe65 | `bash-output-filter.js` PreToolUse whitelist, `filter_rules.json`, visible log |
| Phase 4 — Benchmark harness | ✅ Done | pending | `scripts/benchmark/` — check_sdk.py, token_runner.py, tasks.json (25 tasks), report.py + `bench:*` npm scripts |
| Phase 5 — Agent model routing | ⏳ Pending | — | `status-updater.md` agent with haiku frontmatter, opt-in via `SCAFFOLD_LIGHT_AGENTS=true` |

### Key design decisions:

- `deploySettings()` uses `=== undefined` check — respects explicit user overrides, only sets on first deploy
- Compact signal: two triggers — A) ExitPlanMode (compact BEFORE Step 1), B) tool_call_count threshold (one-shot)
- Benchmark uses Anthropic SDK direct — `response.usage` for input_tokens, output_tokens, cache fields
- Bash filter: PreToolUse `updatedInput` whitelist-only + fallback on any error + log to `.claude/logs/filter-log.jsonl`
- i18n: all user-facing hook blocks covered in EN+RU via `lib/i18n.js` builder functions
- deploySettings() hook merge: matcher-based (not path-based) — preserves user hooks with different matchers
- `isDepsTrigger` boolean replaces fragile `checkpointBlock.includes("BLOCKER")` — language-safe
- Benchmark: 10 bash_filter + 10 skill_activation + 5 edge_case; requires `ANTHROPIC_API_KEY` env var

### Versions:
- **v1.6.0** — published on npm (2026-04-07)
- **v2.0.0** — code complete on main (pending explicit publish)
- **v2.1.0** — in progress on feature branch

---

## Next Session Plan

1. **Запустить бенчмарк** (требует `ANTHROPIC_API_KEY`):
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   npm run bench:check    # → [✓] All checks passed
   npm run bench:token    # baseline + optimized (~50 API calls, ~$0.10 haiku)
   npm run bench:report   # → dev/benchmark-log.md + 3 PNG встроены
   ```

2. **Phase 5**: Agent model routing (opt-in)
   - Создать `.claude/agents/status-updater.md` с frontmatter `model: claude-haiku-4-5-20251001`
   - Изменить `session-start.js`: SCAFFOLD_LIGHT_AGENTS hint injection
   - Добавить тесты

3. **Commit**: `feat: token-opt phase 3-4 — bash output filter and benchmark harness`

4. **После Phase 5**: bump version → 2.1.0, PR feature → main, `/dev-status`

---

## Backlog

- [ ] **npm publish v2.0.0** — ONLY by explicit user command: `git tag v2.0.0 && git push origin v2.0.0`
- [ ] **npm publish v2.1.0** — after token-optimization PR merged
- [ ] Submit to `hesreallyhim/awesome-claude-code` via web UI issue form
- [ ] PR to `anthropics/claude-plugins-official` external_plugins/
- [ ] PRs to 4 more awesome-lists (ccplugins, rahulvrane, cassler, VoltAgent)
- [ ] Ping 3 stale PRs (awesome-llm-skills, awesome-claude-plugins, awesome-ai-devtools)
- [ ] Reddit post in r/ClaudeCode
- [ ] Dev.to article — "Claude Code beyond CLAUDE.md"
- [ ] phs_calorie_app: history rewrite to remove .claude/ from git (commit 359761f)
- [ ] GitHub Actions update: `actions/checkout@v4` → `@v5`, `setup-node@v4` → `@v5` (deadline: June 2026)

---

## Known Issues

### VHS не работает на Windows
VHS зависает из-за oh-my-posh в .bashrc. Решение: рендерить через `ssh yc-ctrl`.

### Python infra tests UnicodeDecodeError на Windows
`read_text()` использует cp1251 по умолчанию. Фикс: `encoding="utf-8"` везде.

### H5 compact signal: tool_call_count — слабый proxy для размера контекста
`git status` и `cat large_file.py` — оба 1 вызов, но 10 токен vs 50k. Порог 40 calls — ориентир, не точное измерение.
Пока оставлено как есть (лучше чем ничего), для точного сигнала нужен токен-счётчик из API response.

### Bash filter: updatedInput в PreToolUse — нужна верификация
Согласно CC docs, поддерживается. Но если нет — fallback: оригинальный вывод без изменений.

---

## Architecture Decisions

| Decision | Choice | Date |
|---|---|---|
| Hook architecture | Pure JS modules (no npm deps) for portability | 2026-03-02 |
| Skill compression | Header extraction + first 50 lines | 2026-03-02 |
| Model routing | Explicit via multimodal-router, no auto-escalation | 2026-03-02 |
| Test strategy | Jest for hooks, Python unittest for infra contracts | 2026-03-02 |
| Priority sort in matchSkills | always_load first, then ascending priority | 2026-03-23 |
| Shared YAML parser | lib/yaml-parser.js — no hook→lib imports | 2026-04-06 |
| Agent extensions | Concatenation at deploy time, idempotency guard | 2026-04-06 |
| Token defaults deploy | `=== undefined` check — one-time, never overwrites user decision | 2026-04-07 |
| Compact signal | Two-trigger: ExitPlanMode (asks /compact before Step 1) + one-shot threshold | 2026-04-07 |
| Bash output filter | PreToolUse `updatedInput` whitelist-only + visible log — no PostToolUse (MCP-only) | 2026-04-07 |
| Benchmark token tracking | Anthropic SDK direct — response.usage fields only, no OpenLIT needed | 2026-04-08 |
| Hook merge in deploySettings | Matcher-based dedup — scaffold owns specific matchers, user hooks preserved by different matcher | 2026-04-08 |
| i18n coverage | All user-facing hook blocks in EN+RU via lib/i18n.js builder functions, lazy-loaded in hooks | 2026-04-08 |
| Gemini routing | Agent frontmatter `model:` + opt-in SCAFFOLD_LIGHT_AGENTS — not hook-based | 2026-04-07 |

---

## Open PRs (публичные репо)

| Repo | PR | Status | Notes |
|---|---|---|---|
| rohitg00/awesome-claude-code-toolkit | #79 | **MERGED** 2026-03-30 | First accepted |
| filipecalegario/awesome-vibe-coding | #100 | **CLOSED** 2026-03-29 | "Need community signals" |
| Prat011/awesome-llm-skills | #56 | open | Ping needed |
| ComposioHQ/awesome-claude-plugins | #66 | open | Ping needed |
| thedaviddias/llms-txt-hub | #787 | open | Vercel auth pending |
| jamesmurdza/awesome-ai-devtools | #326 | open | Ping needed |

---

*Last updated: 2026-04-08*
