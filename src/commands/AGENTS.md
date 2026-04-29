# Commands Directory

V2 CLI commands — each exports a single async action handler registered in `src/index.ts`.

## COMMANDS

| Name | File | Purpose | Key Deps |
|------|------|---------|----------|
| `init` | `init.ts` | Scaffold `.opencode/` dirs, agents, memory-bank, pre-commit | inquirer, chalk, fs, path |
| `ast` | `ast.ts` | Tree-sitter AST indexing → `project_map.md` | execa, chalk, path |
| `sync-skills` | `skills.ts` | Copy skills from TechCon Hub by detected stack | fs, chalk, existsSync |
| `telemetry` | `telemetry.ts` | OTLP HTTP receiver → SQLite trace storage | express, sqlite3, chalk |

## CONVENTIONS

- Export: `export async function {name}Command(options)` — the action handler
- Registration in `index.ts`: `program.command('{name}').description('...').option('...').action({name}Command)`
- Options typed as `{ yes?: boolean }` or `{ dir?: string }` — no shared options type
- ESM imports: always `.js` extension (`import { X } from './skills.js'`)
- Cross-command calls: `init` directly invokes `syncSkillsCommand()` (no CLI re-parse)
- Output: `chalk.cyan.bold()` for headers, `chalk.gray()` for steps, `chalk.green()` for results
- File writes: `fs.mkdir({ recursive: true })` then `fs.writeFile()`
- Error handling: try/catch per command, `console.error` + graceful exit (no thrown errors)

## ANTI-PATTERNS

- No `process.exit()` inside action handlers (except telemetry SIGTERM)
- No shared `Command` instance — each command is a plain async function
- No commander `.parse()` or `.outputHelp()` inside command files
- No `__dirname` via `__dirname` global — use `fileURLToPath(import.meta.url)` (ast.ts pattern)
- Tests: `tests/e2e/{command}.test.ts` via vitest + execa (not unit mocks)
