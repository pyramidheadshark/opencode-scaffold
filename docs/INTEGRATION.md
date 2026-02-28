# Integration Guide — ml-claude-infra

## Overview

This guide explains how to deploy `ml-claude-infra` into a new or existing project so Claude Code works with your domain skills, hooks, and workflow commands from the first prompt.

---

## What Gets Deployed

```
your-project/
├── .claude/
│   ├── hooks/
│   │   ├── skill-activation-prompt.js   # UserPromptSubmit — injects skills
│   │   ├── skill-activation-logic.js    # Testable core logic (no deps)
│   │   ├── python-quality-check.sh      # PostToolUse — runs ruff/mypy on edits
│   │   └── post-tool-use-tracker.sh     # PostToolUse — logs tool usage
│   ├── agents/          # 8 specialized sub-agents
│   ├── commands/        # 4 slash commands (/new-project, /review, etc.)
│   └── skills/          # selected skills only + skill-rules.json
└── dev/
    └── status.md        # session context file (edit before first session)
```

---

## Quick Start (5 minutes)

### Step 1 — Clone the infra repo

```bash
git clone <ml-claude-infra-url> ~/tools/ml-claude-infra
cd ~/tools/ml-claude-infra
npm install
```

### Step 2 — Run deploy script

```bash
# Minimal Python/FastAPI project
./scripts/deploy.sh ~/Repos/my-project \
  --skills python-project-standards,fastapi-patterns,test-first-patterns

# Full ML project
./scripts/deploy.sh ~/Repos/my-project --all

# With test suite (recommended for teams)
./scripts/deploy.sh ~/Repos/my-project --all --with-tests
```

### Step 3 — Create CLAUDE.md in the target project

Copy the profile from this repo and adapt it to your project:

```bash
cp .claude/CLAUDE.md ~/Repos/my-project/.claude/CLAUDE.md
# Edit: update project name, stack, deployment target, etc.
```

Or use the command in Claude Code after deploy:
```
/init-design-doc
```

### Step 4 — Fill in dev/status.md

Open `dev/status.md` in your project and fill in:
- **Business Goal** — one sentence, what this project must achieve
- **Current Phase** — check the active phase
- **Next Session Plan** — first 3 actions for Claude

This file is loaded automatically on every Claude Code prompt.

### Step 5 — Verify the hook works

Open Claude Code in the target project and type a prompt that contains a trigger keyword.
For example: `"How should I structure pyproject.toml?"` should inject `python-project-standards`.

---

## Choosing Which Skills to Include

| Project Type | Recommended Skills |
|---|---|
| FastAPI REST API | `python-project-standards`, `fastapi-patterns`, `test-first-patterns` |
| ML pipeline | `python-project-standards`, `ml-data-handling`, `predictive-analytics` |
| RAG / LLM app | `fastapi-patterns`, `rag-vector-db`, `langgraph-patterns` |
| Full ML platform | `--all` |
| Internal tooling | `python-project-standards`, `fastapi-patterns`, `infra-yandex-cloud` |
| NLP / anonymization | `python-project-standards`, `nlp-slm-patterns`, `test-first-patterns` |

**Skip these for most projects:**
- `design-doc-creator` — only needed during the design phase of a new project (meta-skill, `optional: true`)
- `skill-developer` — only if you're extending the infra itself (meta-skill, `optional: true`)
- `htmx-frontend` — only if using server-side rendering with HTMX

### Meta-skills and `--include-meta`

`design-doc-creator` and `skill-developer` are marked `"optional": true` in `skill-rules.json`. The hook **never loads them automatically**, even when keywords match. This prevents accidental token waste.

To include them in a deploy:

```bash
./scripts/deploy.sh ~/Repos/my-project --all --include-meta
```

Without `--include-meta`, the deploy script excludes optional skills from the generated `skill-rules.json`.

### Skills with `min_keyword_matches`

Some skills use generic keywords that would fire too broadly. They require 2+ keyword matches before activating:

| Skill | Why |
|---|---|
| `langgraph-patterns` | "graph", "node", "state" appear in many non-LangGraph contexts |
| `infra-yandex-cloud` | "docker", "container" appear in general cloud prompts |

A single generic keyword will not trigger these. Two or more specific keywords will.

---

## Configuring Skills After Deploy

### Disable a skill

Remove its directory and the entry from `skill-rules.json`:

```bash
# Remove skill directory
rm -rf .claude/skills/htmx-frontend

# Edit skill-rules.json: delete the block for "htmx-frontend"
```

### Add a custom skill

```
.claude/skills/my-custom-skill/
├── SKILL.md               # required — the main skill content
└── resources/             # optional — subsections for progressive disclosure
    └── topic.md
```

Then add a trigger rule to `skill-rules.json`:

```json
{
  "skill": "my-custom-skill",
  "triggers": {
    "keywords": ["my-keyword"],
    "files": ["*.myext"]
  },
  "priority": 14
}
```

### Adjust the skill limit

In `skill-rules.json`, change `context_management.max_skills_per_session`:

```json
"context_management": {
  "max_skills_per_session": 2,
  ...
}
```

**Recommendation**: keep at 2-3. More than 3 skills = 5000+ tokens per prompt.

---

## Updating the Infra

To pull updates from this repo into a deployed project:

```bash
# Pull latest infra
cd ~/tools/ml-claude-infra
git pull

# Re-deploy (preserves your dev/status.md)
./scripts/deploy.sh ~/Repos/my-project --skills python-project-standards,fastapi-patterns
```

The deploy script skips `dev/status.md` if it already exists.

---

## Token Budget Reference

Approximate token cost per session with skill injection:

| Component | Tokens |
|---|---|
| `dev/status.md` (typical) | ~200 |
| Small skill (<150 lines) | ~800–1 200 |
| Medium skill (150–250 lines) | ~1 500–2 500 |
| Compressed skill (>300 lines) | ~600 (headers only) |
| 3 skills, all medium | ~5 500–8 000 |

These tokens appear at the START of every prompt via `system_prompt_addition`. On a 200K context window, this is < 5%. Acceptable.

---

## Running Tests on the Deployed Infra

If you deployed with `--with-tests`:

```bash
cd ~/Repos/my-project
npm install            # installs jest
npm run test:hook      # 24 unit tests for hook logic
python tests/infra/test_infra.py   # 27 structural tests
```

---

## Troubleshooting

### Hook not activating
1. Check `.claude/settings.json` in the target project — `hooks` must be enabled
2. Verify `skill-activation-prompt.js` is listed under `UserPromptSubmit` hooks
3. Test manually: `echo '{"prompt":"pyproject.toml setup"}' | node .claude/hooks/skill-activation-prompt.js`

### Skills not matching
Check trigger keywords in `skill-rules.json` match what you're typing. Keywords are matched case-insensitively against the full prompt text.

### On Windows: hook fails with stdin error
The hook uses file descriptor `0` (stdin) which works cross-platform. If you see errors, ensure Node.js is in PATH and Claude Code terminal is Git Bash (not cmd/PowerShell).

### On Windows: `npm run test:infra` fails with `python3 not found`
The `test:infra` script falls back to `python` automatically. If both fail, run directly:
```bash
python tests/infra/test_infra.py
```

### dev/status.md not loading
The hook loads status only if `dev/status.md` exists at the project root. If missing, create it:
```bash
cp .claude/templates/status.md dev/status.md  # if infra was deployed with templates
```
