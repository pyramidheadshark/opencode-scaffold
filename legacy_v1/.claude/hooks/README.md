# Hooks

## Overview

Two hooks are essential. The rest are optional quality gates.

| Hook | Type | Required | Purpose |
|---|---|---|---|
| `skill-activation-prompt.js` | UserPromptSubmit | YES | Auto-activates skills based on prompt + file context |
| `post-tool-use-tracker.sh` | PostToolUse | YES | Tracks tool usage, updates context |
| `python-quality-check.sh` | Stop | Optional | Runs ruff + mypy before session ends |

## Installation

Copy these two files to your project's `.claude/hooks/` and register them in `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{"type": "command", "command": "node .claude/hooks/skill-activation-prompt.js"}]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [{"type": "command", "command": "bash .claude/hooks/post-tool-use-tracker.sh"}]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [{"type": "command", "command": "bash .claude/hooks/python-quality-check.sh"}]
      }
    ]
  }
}
```

## Context Management Strategy

**status.md is always loaded first.** The `skill-activation-prompt.js` hook checks for `dev/status.md`
and prepends it to context before any skill activation. This ensures business context is never lost.

**Skill compression**: Skills exceeding 300 lines are summarized before injection.
The hook loads `SKILL.md` headers and section titles first, then loads full sections on demand.
This implements the 500-line / progressive disclosure principle from diet103.

**Max 3 skills per session**: The hook respects `context_management.max_skills_per_session`
from `skill-rules.json`. If more than 3 skills would activate, only the highest-priority ones load.
