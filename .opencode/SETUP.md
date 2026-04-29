# OpenCode Project Configuration Guide

This repository uses [OpenCode](https://opencode.ai) with oh-my-opencode for AI-assisted development.

## Quick Setup

1. Install opencode: `npm i -g opencode`
2. Set `OPENROUTER_API_KEY` in your environment
3. Run `opencode` in this repo — config loads from `.opencode/config.json`

## Per-Project MCP Servers

MCP servers that are **only needed for this project** can be added to `.opencode/config.json` under the `mcp` key:

```jsonc
{
  "mcp": {
    "my-database": {
      "type": "local",
      "command": ["uvx", "mcp-server-sqlite", "--db-path", "data/my.db"],
      "enabled": true
    }
  }
}
```

## Lazy-Loaded MCP via Skills

For MCP servers that are **domain-specific** (Yandex Cloud, ML, SSH), use skill-embedded MCP instead of polluting the global config. Create a skill in `.opencode/skills/my-skill/SKILL.md`:

```yaml
---
name: my-skill
description: What this skill does
mcp:
  my-mcp-server:
    type: local
    command: ["npx", "-y", "my-mcp-package"]
    environment:
      MY_API_KEY: "{env:MY_API_KEY}"
---

## What I do
- Task description

## When to use me
Trigger condition description
```

The MCP server starts on-demand when the skill activates, and auto-stops after 5 minutes idle. No context bloat.

## Custom Rules

Add project-specific rules in `.opencode/rules/*.mdc` with keyword triggers:

```yaml
---
keywords:
  - my-keyword
  - моё-слово
globs:
  - 'src/**/*.py'
---

# My Rule
- Rule content here
```

Rules are injected into the system prompt when keywords match or files are in context.
