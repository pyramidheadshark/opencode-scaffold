import { execa } from 'execa';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function astCommand(options: { dir?: string }) {
  console.log(chalk.cyan.bold('\n🔍 Generating AST Index...'));

  const targetDir = options.dir || process.cwd();
  // Assumes script is at project_root/scripts/generate_ast.py and this file is compiled to dist/index.js
  const scriptPath = path.join(__dirname, '..', 'scripts', 'generate_ast.py');

  try {
    const { stdout } = await execa('python', [scriptPath, targetDir]);
    console.log(chalk.green(stdout));
  } catch (error: any) {
    console.log(chalk.red('\nFailed to generate AST. Make sure `tree-sitter` and `tree-sitter-python` are installed.'));
    console.error(error.stderr || error.message);
  }
}
