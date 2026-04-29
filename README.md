# opencode-scaffold

CLI tool that bootstraps a powerful agentic environment for [OpenCode](https://opencode.ai).

## What it does

Running `opencode-scaffold init` in a project directory generates:

- **`.opencode/`** — agent configs, memory-bank, skill manifests
- **`.pre-commit-config.yaml`** — Python/JS lint gates (ruff, mypy, eslint)
- **Plugin injection** — oh-my-opencode, opencode-dcp into `package.json`
- **Skill sync** — copies relevant skills from a shared hub based on detected tech stack

## Commands

```
opencode-scaffold init          # Interactive scaffolding (-y for defaults)
opencode-scaffold sync-skills   # Sync skills based on local tech stack
opencode-scaffold ast           # Generate AST map for LLM RAG indexing
opencode-scaffold telemetry     # Start OTLP → SQLite telemetry server
```

## Install

```bash
npm install -g opencode-scaffold
```

Or run directly:

```bash
npx opencode-scaffold init -y
```

## Development

```bash
npm run build      # tsup → dist/index.js
npm test           # vitest run tests/e2e/
npx tsc --noEmit   # typecheck
```

## Architecture

- **TypeScript ESM** — Commander CLI, tsup bundler
- **4 commands** — init, sync-skills, ast, telemetry
- **Template system** — `src/templates/opencode-project.jsonc` is the canonical config deployed to target repos

## License

MIT
