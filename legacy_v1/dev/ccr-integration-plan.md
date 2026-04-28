# CCR × OpenRouter Integration Plan

> **Status**: In Progress  
> **Created**: 2026-04-28  
> **Approach**: Variant A — Claude Code + CCR + OpenRouter

---

## 1. Verified OpenRouter Model IDs

| Model | OpenRouter ID | Role | Transformer |
|-------|--------------|------|-------------|
| DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | **Default** for repos | `tooluse` + `enhancetool` |
| GLM 5.1 | `z-ai/glm-5.1` | Hub/Damster repos, quality tasks | `enhancetool` |
| Kimi K2.6 | `moonshotai/kimi-k2.6` | Thinking/reasoning | `reasoning` + `enhancetool` |
| Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` | Fallback, critical tasks | (none) |
| Claude Opus 4.7 | `anthropic/claude-opus-4.7` | Complex reasoning | (none) |
| Claude Haiku 4.5 | `anthropic/claude-haiku-4.5` | Fast tasks | (none) |
| Gemini 2.5 Pro | `google/gemini-2.5-pro` | Long context | `enhancetool` |
| Gemini 2.5 Flash | `google/gemini-2.5-flash` | Fast multimodal | `enhancetool` |

### Model Assignments (per user request)

| Repo Type | Default Model | Reason |
|-----------|--------------|--------|
| **Standard repos** | `deepseek/deepseek-v4-flash` | Fast, cheap, good for code |
| **Hub repo** | `z-ai/glm-5.1` | Quality model for knowledge management |
| **Damster repo** | `z-ai/glm-5.1` | Quality model for complex tasks |

---

## 2. Architecture

```
User → Claude Code → CCR (localhost:3456) → OpenRouter → Models
                           ↑
                           ├── Providers: openrouter (primary)
                           ├── Transformers: tooluse, enhancetool, reasoning, openrouter
                           ├── Router: default/background/think/longContext
                           └── Custom Router: scaffold-mode aware
```

### Separation of Concerns

- **claude-scaffold**: Profiles, Skills, Hooks, Agents, Quota, Modes → configures CCR
- **CCR**: Request transformation, model routing, streaming, tool_use adaptation
- **OpenRouter**: API access to all models

### Key Decisions

1. **CCR as required dependency** — added to `package.json` as `dependencies`
2. **`--provider openrouter` is default** — breaking change, acceptable
3. **`$OPENROUTER_API_KEY` env var** — CCR does env var substitution in config.json
4. **`settings.json`** — we continue using `.claude/settings.json` (not `settings.local.json`)
5. **`ANTHROPIC_API_KEY: ''`** — must be empty string, not null/undefined
6. **Graceful CCR handling** — check CCR status before restart, fallback to `ccr start`
7. **Backward compat** — if CCR not configured, commands show setup instructions
8. **No local mode** — not implementing Ollama support now

---

## 3. Implementation Phases

### Phase 1: Foundation (P0) — ~6h

#### 1.1 `lib/ccr-config.js` — NEW FILE
Core CCR config generation and management module.

**Exports:**
- `generateCCRConfig(profile, options)` → CCR config object
- `updateCCRRouter(newRouter)` → boolean
- `restartCCR()` → Promise<void>
- `checkCCRInstalled()` → boolean
- `installCCR()` → Promise<void>
- `getCCRStatus()` → Promise<{running, pid, port}>
- `getCCRConfigPath()` → string

**PROFILE_CCR_ROUTING mapping:**

| scaffold profile | default | background | think | longContext |
|-----------------|---------|------------|-------|-------------|
| ml-engineer | deepseek-v4-flash | deepseek-chat | kimi-k2.6 | gemini-2.5-pro |
| ai-developer | deepseek-v4-flash | deepseek-chat | kimi-k2.6 | gemini-2.5-pro |
| fastapi-developer | deepseek-v4-flash | glm-5.1 | kimi-k2.6 | gemini-2.5-pro |
| fullstack | deepseek-v4-flash | glm-5.1 | kimi-k2.6 | gemini-2.5-pro |
| hub | glm-5.1 | deepseek-v4-flash | kimi-k2.6 | gemini-2.5-pro |
| task-hub | deepseek-v4-flash | deepseek-chat | kimi-k2.6 | gemini-2.5-pro |

#### 1.2 `lib/models.js` — UPDATE
- Add `OPENROUTER_MODELS` object with all OpenRouter model IDs
- Add `OPENROUTER_PROFILE_MATRIX` for CCR routing
- Update `VALID_MODES` to include: `reasoning`, `openrouter-full`
- Add `MODE_CCR_ROUTING` for mode → Router rules mapping

#### 1.3 `lib/deploy/copy.js` — UPDATE
- In `applyTuningDefaults()`: when provider is openrouter, set:
  - `ANTHROPIC_BASE_URL: 'http://127.0.0.1:3456'`
  - `ANTHROPIC_AUTH_TOKEN: '$OPENROUTER_API_KEY'` (literal string, CCR resolves)
  - `ANTHROPIC_API_KEY: ''` (empty string!)
  - `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1'`
- Add `scaffold.provider`, `scaffold.ccrEnabled` to settings

#### 1.4 `lib/commands/init.js` — UPDATE
- Add `--provider` flag (default: `openrouter`)
- When `--provider openrouter`:
  - Check CCR installed → if not, install via npm
  - Generate `~/.claude-code-router/config.json`
  - Generate `~/.claude-code-router/custom-router.js`
  - Deploy CCR preset
  - Deploy settings with CCR env vars

### Phase 2: Commands (P1) — ~6h

#### 2.1 `lib/commands/model-router.js` — UPDATE
- Add `OPENROUTER_MODEL_PRESETS` with all models
- Update `use()` to modify CCR config instead of env vars
- Add `--session` flag for `/model` command output
- Add `use status` to show current CCR Router.default

#### 2.2 `lib/commands/mode.js` — UPDATE
- Add `MODE_CCR_ROUTING` mapping
- Update `applyMode()` to modify CCR Router + `ccr restart`
- Add modes: `reasoning`, `openrouter-full`
- Save mode to `~/.claude/scaffold-mode`
- Fallback to legacy if CCR not configured

#### 2.3 `bin/cli.js` — UPDATE
- Add CCR commands: `ccr-setup`, `ccr-status`, `ccr-restart`, `ccr-config`
- Update `use` and `mode` command descriptions

### Phase 3: Hooks & Skills (P1) — ~2h

#### 3.1 `.claude/hooks/session-start.js` — UPDATE
- Add CCR health check at session start
- If CCR not running → inject warning: `⚠️ Claude Code Router не запущен. Выполни: ccr start`
- Remove old model conflict detection (CCR handles routing now)

#### 3.2 `.claude/hooks/session-status-monitor.js` — UPDATE
- Read current model from CCR config instead of env vars
- Show model name in statusline

### Phase 4: Templates (P2) — ~3h

#### 4.1 `templates/ccr/custom-router.js` — NEW FILE
Custom CCR router that:
- Reads scaffold mode from `~/.claude/scaffold-mode`
- Routes think-keyword queries to Router.think
- Routes short queries to Router.background
- Falls back to CCR's default routing

#### 4.2 `templates/ccr/preset/manifest.json` — NEW FILE
CCR preset for scaffold with all model definitions and transformers.

### Phase 5: Tests — ~6h

#### 5.1 Unit Tests — `tests/ccr/`
- `ccr-config.test.js` — generateCCRConfig, updateCCRRouter, checkCCRInstalled
- `mode-ccr.test.js` — mode → CCR Router rules
- `model-router-ccr.test.js` — use → CCR model switching, --session flag

#### 5.2 Update Existing Tests
- `tests/cli/mode.test.js` — add CCR mode test cases
- `tests/cli/model-router.test.js` — add OpenRouter preset tests
- `tests/cli/models.test.js` — add OpenRouter model resolution tests

#### 5.3 E2E Tests
- CCR start → health check → model routing → response
- Model switching via `use` command → CCR config update → restart
- Mode switching → CCR Router update → restart

---

## 4. File Change Summary

### New Files (6)
| File | Purpose |
|------|---------|
| `lib/ccr-config.js` | CCR config generation and management |
| `templates/ccr/custom-router.js` | Custom CCR router template |
| `templates/ccr/preset/manifest.json` | CCR preset definition |
| `tests/ccr/ccr-config.test.js` | CCR config unit tests |
| `tests/ccr/mode-ccr.test.js` | CCR mode integration tests |
| `tests/ccr/model-router-ccr.test.js` | CCR model routing tests |

### Modified Files (9)
| File | Changes |
|------|---------|
| `lib/models.js` | Add OPENROUTER_MODELS, MODE_CCR_ROUTING, new modes |
| `lib/commands/init.js` | Add --provider, CCR setup flow |
| `lib/deploy/copy.js` | CCR env vars in applyTuningDefaults |
| `lib/commands/mode.js` | CCR Router integration, new modes |
| `lib/commands/model-router.js` | OpenRouter presets, --session flag |
| `bin/cli.js` | New CCR commands |
| `.claude/hooks/session-start.js` | CCR health check |
| `.claude/hooks/session-status-monitor.js` | Read model from CCR config |
| `package.json` | Add CCR dependency |

---

## 5. E2E Test Scenarios

### Scenario 1: Fresh Install
```
1. npx claude-scaffold init /test-repo --provider openrouter --profile ai-developer
2. Verify: ~/.claude-code-router/config.json exists with correct Router rules
3. Verify: /test-repo/.claude/settings.json has ANTHROPIC_BASE_URL=http://127.0.0.1:3456
4. Verify: ANTHROPIC_API_KEY is empty string
5. ccr start
6. curl http://127.0.0.1:3456/health → 200 OK
7. ccr code → Claude Code connects through CCR
```

### Scenario 2: Model Switching
```
1. claude-scaffold use glm
2. Verify: config.json Router.default = "openrouter,z-ai/glm-5.1"
3. Verify: CCR restarted
4. claude-scaffold use deepseek
5. Verify: config.json Router.default = "openrouter,deepseek/deepseek-v4-flash"
6. claude-scaffold use kimi --session
7. Verify: outputs "/model openrouter,moonshotai/kimi-k2.6"
```

### Scenario 3: Mode Switching
```
1. claude-scaffold mode economy
2. Verify: Router.default = "openrouter,deepseek/deepseek-v4-flash"
3. Verify: Router.background = "openrouter,deepseek/deepseek-v4-flash"
4. claude-scaffold mode default
5. Verify: Router restored to profile defaults
6. claude-scaffold mode reasoning
7. Verify: Router.default = "openrouter,moonshotai/kimi-k2.6"
```

### Scenario 4: Session Start Hook
```
1. ccr start
2. Start Claude Code in a deployed repo
3. Verify: no CCR warning in session
4. ccr stop
5. Start Claude Code again
6. Verify: ⚠️ CCR warning injected
```

### Scenario 5: Full Pipeline
```
1. ccr start
2. ccr code
3. Send "напиши hello world на Python"
4. Verify: request goes through CCR → OpenRouter → DeepSeek V4 Flash → response
5. Verify: tool_use works (file creation)
6. claude-scaffold use sonnet
7. Send same prompt
8. Verify: request routed to Claude Sonnet 4.6
```

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| CCR doesn't work on Windows | Medium | High | Test early, document WSL fallback |
| Streaming tool_call args empty | Medium | Medium | `enhancetool` transformer, fallback to Sonnet |
| CCR timeout on long reasoning | Low | Medium | API_TIMEOUT_MS=600000, monitor logs |
| CCR config format changes | Low | High | Pin CCR version in dependencies |
| OpenRouter model IDs change | Low | Low | Centralized model ID registry in ccr-config.js |