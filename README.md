<div align="center">

# 🏗️ opencode-scaffold

**Bootstrap a powerful agentic environment for [OpenCode](https://opencode.ai) in seconds**

[![npm version](https://img.shields.io/npm/v/opencode-scaffold?color=blue&label=npm)](https://www.npmjs.com/package/opencode-scaffold)
[![license](https://img.shields.io/github/license/pyramidheadshark/opencode-scaffold)](LICENSE)
[![node](https://img.shields.io/node/v/opencode-scaffold?color=green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](#features) · [Русский](README.ru.md)

</div>

---

## ✨ Features

### 🤖 AI Agent Team
Sets up a complete agent hierarchy — from an orchestrating Architect to specialized sub-agents for testing, security, and performance analysis. Each agent knows its role and works autonomously.

### 🧠 Persistent Memory Bank
No more context amnesia between sessions. The memory bank stores project briefs, progress logs, and active context — your AI agents remember what you built yesterday.

### 🔍 Auto Skill Detection
Detects your tech stack (Python, FastAPI, Node.js, React) and copies relevant skills automatically. FastAPI project? You get API patterns. Python repo? Testing patterns. Zero configuration.

### 🔒 Pre-commit Guards
Generates battle-tested pre-commit hooks: ruff for linting, mypy for types, eslint for JS, plus a test gate that runs pytest or npm test before every commit.

### 📊 Telemetry Server
Built-in OTLP listener that maps traces to SQLite — see exactly how your agents spend their context budget and which tools they call most.

### 🌳 AST Indexing
Generates a tree-sitter-powered project map for LLM RAG indexing. Your AI agents get a structural understanding of the codebase, not just raw text.

---

## 🚀 Quick Start

```bash
# One command — no install needed
npx opencode-scaffold init -y
```

That's it. Your project now has:

```
your-project/
├── .opencode/
│   ├── agents/              # 🤖 Agent configs + prompts
│   │   ├── architect.md
│   │   ├── qa_engineer.md
│   │   ├── security_sentinel.md
│   │   ├── performance_analyst.md
│   │   └── prompts/
│   ├── memory-bank/         # 🧠 Persistent context
│   │   ├── projectbrief.md
│   │   ├── activeContext.md
│   │   ├── progress.md
│   │   ├── systemContext.md
│   │   └── productContext.md
│   ├── skills/              # 🔍 Auto-detected skills
│   ├── config.json          # ⚙️ Per-project config
│   └── OPENCODE.md          # 📋 Entry prompt
├── .pre-commit-config.yaml  # 🔒 Lint + test gates
└── .opencode-scaffold.json  # 📦 Manifest
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `opencode-scaffold init` | Interactive scaffolding (use `-y` for defaults) |
| `opencode-scaffold sync-skills` | Detect tech stack and sync relevant skills |
| `opencode-scaffold ast` | Generate AST map for LLM RAG indexing |
| `opencode-scaffold telemetry` | Start OTLP → SQLite telemetry server |

## 🤖 Generated Agents

| Agent | Role | Mode | Description |
|-------|------|------|-------------|
| 🏛️ Architect | Orchestrator | Primary | Main agent — delegates work, maintains memory bank |
| 🧪 QA Engineer | Testing | Subagent | E2E tests, defect reports, 3 retries max |
| 🛡️ Security Sentinel | Security | Subagent | Vulnerability scanning, injection risks, supply chain |
| ⚡ Performance Analyst | Optimization | Subagent | Big-O analysis, memory leaks, N+1 queries |

Agents are configured for [Z.AI Coding Plan](https://z.ai) models but can be changed per-project via `.opencode/config.json`.

## 🔌 Plugin Ecosystem

The generated config includes a curated plugin stack:

| Category | Plugins |
|----------|---------|
| Orchestration | [oh-my-openagent](https://github.com/nicepkg/oh-my-opencode), [opencode-skillful](https://github.com/nicepkg/opencode-skillful) |
| Context | [@tarquinen/opencode-dcp](https://github.com/Tarquinen/opencode-dcp), [opencode-mem](https://github.com/nicepkg/opencode-mem) |
| Quality | [opencode-vibeguard](https://github.com/nicepkg/opencode-vibeguard), [cc-safety-net](https://github.com/nicepkg/cc-safety-net) |
| Efficiency | [opencode-tool-search](https://github.com/nicepkg/opencode-tool-search), [opencode-lazy-loader](https://github.com/nicepkg/opencode-lazy-loader) |
| Governance | [opencode-rules](https://github.com/nicepkg/opencode-rules), [opencode-command-hooks](https://github.com/nicepkg/opencode-command-hooks) |
| MCP Servers | Web Search, Web Reader, GitHub Knowledge (zread), SQLite |

## 🛠️ Development

```bash
git clone https://github.com/pyramidheadshark/opencode-scaffold.git
cd opencode-scaffold
npm install
npm run build      # tsup → dist/index.js
npm test           # vitest run tests/e2e/
npx tsc --noEmit   # typecheck
```

## 📦 Publishing

```bash
npm run build
npm version patch        # or minor, major
npm publish --access public
```

## 📝 Dependencies & Attribution

| Library | Purpose | Author | License |
|---------|---------|--------|---------|
| [commander](https://github.com/tj/commander.js) | CLI framework | [@tj](https://github.com/tj) | MIT |
| [inquirer](https://github.com/SBoudrias/Inquirer.js) | Interactive prompts | [@SBoudrias](https://github.com/SBoudrias) | MIT |
| [chalk](https://github.com/chalk/chalk) | Terminal styling | [@chalk](https://github.com/chalk) | MIT |
| [express](https://github.com/expressjs/express) | Telemetry HTTP server | [Express.js](https://github.com/expressjs) | MIT |
| [sqlite3](https://github.com/TryGhost/node-sqlite3) | Telemetry storage | [Ghost Foundation](https://github.com/TryGhost) | BSD-3-Clause |
| [tsup](https://github.com/egoist/tsup) | Build tool | [@egoist](https://github.com/egoist) | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Type system | [Microsoft](https://github.com/microsoft) | Apache-2.0 |
| [vitest](https://github.com/vitest-dev/vitest) | Test framework | [@sheremet-va](https://github.com/sheremet-va) | MIT |
| [execa](https://github.com/sindresorhus/execa) | Process execution | [@sindresorhus](https://github.com/sindresorhus) | MIT |

## License

[MIT](LICENSE) © pyramidheadshark
