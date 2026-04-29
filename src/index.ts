import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { syncSkillsCommand } from './commands/skills.js';
import { telemetryServerCommand } from './commands/telemetry.js';
import { astCommand } from './commands/ast.js';

const program = new Command();

program
  .name('opencode-scaffold')
  .description('CLI tool to scaffold a powerful agentic environment for OpenCode')
  .version('2.0.0');

program
  .command('init')
  .description('Initialize opencode-scaffold in the current repository')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(initCommand);

program
  .command('sync-skills')
  .description('Sync skills from TechCon Hub based on local tech stack')
  .action(syncSkillsCommand);

program
  .command('telemetry')
  .description('Start a local OpenTelemetry listener mapping to SQLite')
  .action(telemetryServerCommand);

program
  .command('ast')
  .description('Generate AST project map for LLM RAG indexing')
  .option('-d, --dir <path>', 'Target directory to index')
  .action(astCommand);

program.parse(process.argv);
