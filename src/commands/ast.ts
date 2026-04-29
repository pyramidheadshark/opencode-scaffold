import { execa } from 'execa';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function astCommand(options: { dir?: string }) {
  console.log(chalk.cyan.bold('\n🔍 Generating AST Index...'));

  const targetDir = options.dir || process.cwd();
  console.log(`Target Dir: ${targetDir}`);
  // We use `__dirname` which is in dist/commands when running compiled code, or src/commands when running tsx
  // By calculating path from project root we avoid dist/src confusion if we just rely on process.cwd() or relative from package root.
  // Instead of relative to __dirname, let's find the package root.
  const packageRoot = path.join(__dirname, '..');
  const scriptPath = path.join(packageRoot, 'scripts', 'generate_ast.py');

  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout } = await execa(pythonCmd, [scriptPath, targetDir]);
    console.log(chalk.green(stdout));
  } catch (error: any) {
    console.log(chalk.red('\nFailed to generate AST. Make sure `tree-sitter` and `tree-sitter-python` are installed.'));
    console.error(error.stderr || error.message);
  }
}
