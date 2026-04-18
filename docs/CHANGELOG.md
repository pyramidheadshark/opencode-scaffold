# Changelog

All notable changes to `claude-scaffold` are documented here.
Format: [Semantic Versioning](https://semver.org/).

---

## v2.4.0 — 2026-04-17

### Added
- **StatusLine hook `session-status-monitor.js`** — displays `ctx: ⚠ X%` (or `ctx: X%`) in the Claude Code status bar after every API response. Writes `context_critical: bool` and `context_remaining_pct` to session checkpoint cache. Threshold default 20% remaining; configurable via `SCAFFOLD_CONTEXT_THRESHOLD` env var.
- **Token-aware compact signal** — `session-checkpoint.js` reads `context_critical` from cache on each PostToolUse event. When `true`, injects a compact signal into `additionalContext` with instructions to update `dev/status.md` and use the "Clear context" button. Replaces the unreliable 25-message count heuristic.
- `statusLine` top-level key written to `settings.json` on `init`/`update` (non-overwrite). Note: `statusLine` is a top-level settings.json property, not a hook event inside `hooks`.

### Changed
- **PostToolUse matchers split** — `post-tool-use-tracker.js` now fires on `Bash|Edit|Write` only (was `.*`). Fixes `uv_spawn EUNKNOWN` errors on Windows caused by spawning two Node processes on every Read/Glob/Grep.
- `session-checkpoint.js` — removed `DEFAULT_THRESHOLD = 25`, `SCAFFOLD_COMPACT_THRESHOLD` env var, and `compact_signal_sent` one-shot logic. Now purely driven by the `context_critical` flag.
- `i18n.js` (EN + RU, both copies) — `compact_required_body` no longer instructs `/compact` before Step 1; now references the "Clear context" button. `threshold_body` shows remaining `%` instead of threshold value. `buildThresholdCheckpointBlock(pct, lang)` signature updated.
- `CLAUDE.md` — two new "What You Never Do" rules: `MSYS_NO_PATHCONV=1 gh api` for Windows Git Bash path mangling, and SSH host aliases instead of raw IPs.

### Tests
- +10 Jest (`tests/hook/session-status-monitor.test.js`) — context_critical flag, stdout format, custom threshold env, robustness, cache merge.
- +3 Jest (`tests/hook/session-checkpoint.test.js`) — context_critical trigger, pct display, Clear context text, no false positive.
- +1 Python (`tests/infra/test_infra.py`) — `test_deploy_settings_has_status_line`, `test_deploy_post_tool_use_split_matchers`.
- Total: 563 Jest + 62 Python, all green.

---

## v2.3.1 — 2026-04-15

### Fixed
- **`scripts/deploy.py` parity** — Python deploy path now writes the same thinking defaults as the JS path (`CLAUDE_CODE_EFFORT_LEVEL=max`, `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`, `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`, `showThinkingSummaries=true`, `showClearContextOnPlanAccept=true`). Prior to this, `python scripts/deploy.py --update-all` shipped the hook block but no env/settings — leaving deployed repos without the v2.3.0 defaults despite the SHA showing "up to date".
- `apply_tuning_defaults(existing)` added as a pure helper, mirroring `applyTuningDefaults` in `lib/deploy/copy.js`. Non-overwrite semantics preserved.

### Tests
- +2 Python (`test_deploy_writes_thinking_defaults`, `test_deploy_settings_preserves_existing_env_values`) — 554 Jest + 61 Python, all green.

---

## v2.3.0 — 2026-04-15

### Added
- **Thinking Defaults** — `deploySettings` writes three Anthropic-recommended keys on `init`/`update` (non-overwrite): `env.CLAUDE_CODE_EFFORT_LEVEL=max`, `env.CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`, top-level `showThinkingSummaries=true`. Restores full thinking depth after Anthropic silently lowered defaults in Feb–Mar 2026.
- **CLI flags** on `init` and `update`: `--effort <max|high|medium|off>`, `--adaptive-thinking <on|off>`, `--thinking-summaries <on|off>`. `off` on deploy = skip the key (keep whatever Claude Code defaults to).
- **`claude-scaffold tune` command** — post-deploy explicit overwrite of the three settings. Uses `applyTuningOverwrite` (in contrast to the non-overwrite `applyTuningDefaults` used by deploy).
- `lib/commands/tune.js` with 10 Jest cases covering overwrite, key deletion, corrupt-JSON recovery, and hook preservation.

### Changed
- `lib/deploy/copy.js` refactored: `applyTuningDefaults(existing, tuning)` and `applyTuningOverwrite(existing, tuning)` extracted as pure exported functions. `DEFAULT_TUNING = { effort: 'max', adaptiveThinking: 'off', thinkingSummaries: 'on' }`.
- `deploySettings(targetDir)` → `deploySettings(targetDir, tuning)`. Old call sites still work (tuning is optional).
- `updateOne`/`updateAll` accept an optional `tuning` argument threaded through to `deploySettings`.
- README slimmed from 522 to 345 lines; removed version-stamped section headings; added "Thinking Defaults" section.

### Tests
- 554 Jest + 59 Python (all green), +20 from 2.2.1 baseline.

### Notes
- Canonical env var is `CLAUDE_CODE_EFFORT_LEVEL` — not `CLAUDE_REASONING_EFFORT`, and not the `effortLevel` top-level setting (broken per GH #35904).
- Attribution: defaults follow Anthropic / Claude Code team recommendations (HN thread with Boris).

---

## v1.4.1 — 2026-03-23

### Added
- **`critical-analysis` skill v1.1** — 8-role SPP auto-critique (Security, Perf, DA, Crutch, Strategy, ML, TestCov, Obs); anti-collapse enforcement; PLATEAU dual-threshold (abs < 0.01 AND rel < 5%); Strategic Horizon falsifiability gate; design-doc check; 37 keywords (EN + RU prefixes); `priority=0`
- **`database-migration-safety` skill v1.0** — pre-migration checklist, reversibility enforcement, Alembic `--autogenerate` caveats, non-locking ops guidance
- **`supply-chain-auditor` skill v1.0** — dependency pinning rules, CVE audit commands, maintenance signal, anti-patterns for pip/npm/uv

### Changed
- `skill-activation-logic.js` — `matchSkills` now sorts rules by priority (ascending) before iterating; `always_load` skills guaranteed first slot; `priority=0` (critical-analysis) wins non-always slot competition
- `skill-rules.json` — critical-analysis: 37 keywords (up from 6), priority 0; +2 new entries (database-migration-safety p=19, supply-chain-auditor p=20)
- `CLAUDE.md` — Skill Inventory updated: +database-migration-safety, +supply-chain-auditor
- `README.md` — badges updated (20 skills, 57 Python tests), skill table updated

### Tests
- 350 Jest + 57 Python (all green)
- `TestCriticalAnalysisSkill`: +3 tests (keyword count ≥30, role count =8, trigger simulation via isolated subprocess)
- Trigger simulation uses temp git repo to avoid cwd contamination

---

## v1.4.0 — 2026-03-22

### Added
- **Session Safety** — `session-safety.js` PreToolUse hook: classifies every Bash command (CRITICAL/MODERATE/SAFE) against `destructive-patterns.json`
- **Per-command git snapshots** — CRITICAL commands trigger `git tag claude/s-{session8}` before execution; subsequent CRITICALs create `-2`, `-3`, ... tags in the same session
- **Pending notification** — snapshot tag + restore instructions injected at the top of next prompt via `pending_notification` in session cache
- **JSONL audit log** — every tool call logged to `.claude/logs/sessions/session-{date}-{id8}.jsonl` with auto-rotation at 30 files
- **Context refresh at weight=30** — `skill-activation-prompt.js` reinjects core rules after long sessions
- **`session-logs` CLI command** — `npx claude-scaffold session-logs --list/--tail/--session`
- **curl|bash CRITICAL patterns** — `curl ... | bash` and `wget ... | sh` classified as CRITICAL
- **`--force-with-lease` MODERATE** — added to `destructive-patterns.json`
- **`sanitizeSessionId`** — path traversal prevention in JSONL filenames and git tag names
- **`isSafeTarget` boundary check** — `rm -rf /node_modules_backup` no longer classified SAFE
- **PATTERNS IIFE** — `destructive-patterns.json` cached at module init, not per-invocation

### Changed
- `session-utils.js` — exports `sanitizeSessionId`; `getSessionJsonlPath` uses it
- `skill-activation-prompt.js` — reads and clears `pending_notification` from session cache on next UserPromptSubmit
- Session cache uses `snapshot_count: int` instead of `snapshot_taken: bool` (backwards compatible)
- `package.json` — version 1.4.0, author, homepage, repository, bugs fields added

### Tests
- 350 Jest + 48 Python (all green)

---

## v1.3.1 — 2026-03-20

### Added
- `docs/demo.gif` — Catppuccin Mocha GIF, rendered via VHS on yc-ctrl VM
- `demo.tape` — VHS tape for reproduction
- `llms.txt` — AI agent discoverability file

---

## v1.3.0 — 2026-03-18

### Added
- **Org profiles** — `org-profiles/<org>/` team-specific CLAUDE.md templates, gitignored
- `lib/commands/org-profile.js` — `loadOrgProfile`, `deployOrgTemplate`, `writeScaffoldMeta`, `listOrgProfiles`, `updateOrgProfile`
- `--org-profile` / `--org-type` flags on `init` command
- `list-org-profiles` and `update-org-profile` CLI commands
- `org-profiles/techcon-ml/` — 4 project types × 2 languages = 8 templates
- 28 new tests in `tests/cli/org-profile.test.js`

---

## v1.2.3 — 2026-03-17

### Changed
- README badges updated, test count 198 → 226

---

## v1.2.2 — 2026-03-16

### Fixed
- Isolate registry writes in CLI tests (no cross-test contamination of `deployed-repos.json`)

---

## v1.2.0 — 2026-03-15

### Added
- Interactive `init` wizard (no-args mode)
- `--dry-run` flag for `init` command
- `add-skill` CLI command — add a skill to an existing deployed project

---

## v1.1.0 — 2026-03-15

### Added
- **Known Pitfalls** sections in all 4 profile templates (EN + RU) — role-specific warnings for Pydantic v2, MLflow context, HTMX scope, Claude API tool_use format
- **New skill: `experiment-tracking`** — MLflow runs, artifact logging, model registry, cross-validation tracking (~180 lines)
- **New skill: `data-validation`** — Pandera schemas, Pydantic data contracts, ML pipeline validation (~150 lines)
- **FastAPI streaming/async section** — SSE for LLM streaming, WebSockets, background tasks, Anthropic streaming
- **`npx claude-scaffold metrics`** command — skill load frequency report from `.claude/logs/skill-metrics.jsonl`
- **Periodic commit rules reminder** in `session-start.js` — injected every 10 sessions
- **GitHub community files** — bug/feature/skill-request issue templates, PR template, Dependabot config
- **`examples/`** directory — fastapi-minimal and ml-pipeline setup snapshots
- **`nbstripout` + `detect-secrets`** added to pre-commit template

### Changed
- **`fullstack` profile** — removed `ml-data-handling` from default skill set (fullstack = FastAPI + HTMX + testing, not ML pipeline)
- **`ml-engineer` profile** — added `experiment-tracking` to default skill set
- **Profile "What You Never Do"** — 3 additional role-specific rules per profile
- **`python-quality-check.js`** — graceful degradation when ruff/mypy not installed
- **CI pipeline** — `npm audit --audit-level=high` added to jest job
- **`ml-heavy.yml` template** — Python 3.11 + 3.12 matrix strategy for test job

### Fixed
- N/A (hardening fixes were part of v1.0.0 pre-release work)

---

## [0.5.0] — 2026-03-02

### Added

- `tests/hook/skill-activation.test.js` — 24 unit tests for skill activation logic (Jest)
- `tests/infra/test_infra.py` — 27 structural integrity tests (Python unittest)
- `tests/SMOKE_TESTS.md` — 7 manual smoke test scenarios for agents and commands
- `.claude/hooks/skill-activation-logic.js` — pure logic module extracted for testability
- `.claude/skills/fastapi-patterns/resources/background-tasks.md` — FastAPI BackgroundTasks + ARQ pattern

### Changed

- `skill-activation-prompt.js` refactored into thin I/O layer over `skill-activation-logic.js`
- `package.json` updated with Jest test scripts (`test`, `test:hook`, `test:infra`, `test:watch`)

### Fixed (found by tests)

- `fastapi-patterns/SKILL.md` referenced `background-tasks.md` which did not exist → created
- `skill-developer/SKILL.md` had placeholder resource references `topic.md` and `*.md` → removed
- `infra-provisioner.md` missing `Workflow` section → added

---

## [0.4.0] — 2026-03-02

### Added

- Skill: rag-vector-db (Qdrant adapter, pgvector, local embeddings, chunking, ingestion pipeline, RAG service, reranking, RAGAS evaluation)
- Command: /init-design-doc (interactive design document wizard)
- docs/ARCHITECTURE.md (10 ADRs covering all major architectural decisions)
- CLAUDE.md updated with full skill/agent/command inventory tables
- skill-rules.json: 13 skills total (added rag-vector-db)
- ml-data-handling: feature-store.md (FeatureCache pattern, drift detection)

---

## [0.3.0] — 2026-03-02

### Added

- Skills (2 new): nlp-slm-patterns (Ollama, vLLM, Presidio, custom NER, quantization), predictive-analytics (sklearn, MLflow, Optuna, SHAP)
- Resources: spacy-ner.md, model-quantization.md, hyperparameter-tuning.md, feature-importance.md
- Resources for existing skills: dependency-injection.md, middleware.md, multi-agent.md
- Agents (2 new): project-status-reporter, debug-assistant
- Templates (3 new): pyproject.toml, .env.example, Makefile
- skill-rules.json: 12 skills total

---

## [0.2.0] — 2026-03-02

### Added

- Skills (6 new, all full): `ml-data-handling`, `htmx-frontend`, `langgraph-patterns`, `infra-yandex-cloud`, `design-doc-creator`, `skill-developer`
- Resources: `ml-data-handling/dvc-alternative.md`, `langgraph-patterns/streaming.md`, `langgraph-patterns/testing-agents.md`, `infra-yandex-cloud/cloud-init.md`, `infra-yandex-cloud/github-actions-deploy.md`
- Agents (3 new): `code-reviewer`, `multimodal-analyzer`, `infra-provisioner`, `refactor-planner`
- Commands (2 new): `/new-project`, `/review`
- `post-tool-use-tracker.sh` hook
- `.claude/settings.json` — hook registration example

### Changed

- `skill-developer/SKILL.md` — added current skill inventory table

---

## [0.1.0] — 2026-03-02

### Added

- `CLAUDE.md` — global ML engineer profile (Hexagonal Architecture, tech stack, model routing)
- Skills: `python-project-standards`, `fastapi-patterns`, `multimodal-router`, `test-first-patterns`
- Skill stubs: `ml-data-handling`, `htmx-frontend`, `langgraph-patterns`, `infra-yandex-cloud`, `design-doc-creator`, `skill-developer`
- `skill-rules.json` — auto-activation rules for all 10 skills
- `skill-activation-prompt.js` hook — UserPromptSubmit hook with status.md injection + skill compression
- `python-quality-check.sh` hook — Stop hook running ruff + mypy
- Agents: `design-doc-architect`, `test-architect`
- Commands: `/dev-status`
- Templates: `design-doc.md`, `status.md`, `Dockerfile`, `docker-compose.yml`
- GitHub Actions workflows: `lint.yml`, `test.yml`, `build.yml`
- `README.md` with VS Code extension recommendations
