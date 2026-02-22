# ml-claude-infra

Personal Claude Code infrastructure for ML engineering projects.

Built on top of [diet103/claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase) patterns, adapted for Python / ML / FastAPI / Yandex Cloud stack.

## What's Inside

- **Skills** — auto-activating domain knowledge injected into Claude's context on demand
- **Hooks** — automation at key Claude Code lifecycle events
- **Agents** — specialized sub-agents for complex tasks
- **Commands** — slash commands for repeatable workflows
- **Templates** — project scaffold templates (repository structure, configs)

## Core Principles

1. Every project is an instantiation of a single template — pick modules, not patterns
2. Design document comes first, tests come second, code comes third
3. Context is sacred — never lose business logic across resets
4. Skills are modular and compressed — 500-line rule, progressive disclosure
5. Model routing is deterministic — Claude Code for code, Gemini 3 Flash for multimodal

## Model Routing

| Task | Model | Provider |
|---|---|---|
| All code, architecture, tests | `claude-sonnet-4-6` | Claude Code subscription |
| PDF / image / video analysis | `google/gemini-3-flash-preview` | OpenRouter |
| Documents 400k+ tokens | `google/gemini-3-flash-preview` | OpenRouter |

## Skill Activation

Skills activate automatically via `UserPromptSubmit` hook using `skill-rules.json` trigger patterns.
Heavy skills are compressed before context injection using LLMLingua-2 strategy
(see `.claude/hooks/README.md` for details).

## Getting Started

```bash
cp -r .claude /path/to/your-project/
cp templates/pyproject.toml /path/to/your-project/
cp templates/.pre-commit-config.yaml /path/to/your-project/
```

Then customize `skill-rules.json` for your project's file structure.

## Repository Structure

```
ml-claude-infra/
├── .claude/
│   ├── skills/                 # 13 domain skills
│   ├── hooks/                  # lifecycle automation
│   ├── agents/                 # specialized sub-agents
│   └── commands/               # slash commands
├── templates/                  # project scaffold files
├── docs/                       # architecture decisions
└── README.md
```

## VS Code Setup

Install these extensions for the best experience:

- `anthropic.claude-code` — official Claude Code extension (primary)
- `charliermarsh.ruff` — real-time linting in editor
- `eamodio.gitlens` — inline git history and annotations
- `usernamehw.errorlens` — inline error display (pairs with mypy)

## Versioning

Each release is a zip archive. Format: `ml-claude-infra-vX.Y.Z.zip`
Changelog is maintained in `docs/CHANGELOG.md`.
