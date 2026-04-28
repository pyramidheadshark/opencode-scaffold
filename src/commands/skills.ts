import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { existsSync } from 'fs';

const HUB_SKILLS_PATH = 'C:\\Users\\pyramidheadshark\\Repos\\techcon_hub\\.claude\\skills';

export async function syncSkillsCommand() {
  console.log(chalk.cyan('🔄 Syncing skills from TechCon Hub...'));

  const cwd = process.cwd();
  const destSkillsDir = path.join(cwd, '.opencode', 'skills');

  // Check if hub path exists
  if (!existsSync(HUB_SKILLS_PATH)) {
    console.log(chalk.yellow(`⚠️ Hub skills path not found: ${HUB_SKILLS_PATH}`));
    return;
  }

  await fs.mkdir(destSkillsDir, { recursive: true });

  const techStack = new Set<string>();

  // Detect tech stack
  if (existsSync(path.join(cwd, 'requirements.txt'))) techStack.add('python');
  if (existsSync(path.join(cwd, 'pyproject.toml'))) techStack.add('python');
  if (existsSync(path.join(cwd, 'package.json'))) techStack.add('node');
  
  try {
    const reqs = await fs.readFile(path.join(cwd, 'requirements.txt'), 'utf8');
    if (reqs.includes('fastapi')) techStack.add('fastapi');
    if (reqs.includes('langgraph')) techStack.add('langgraph');
  } catch (e) {}

  try {
    const pkg = await fs.readFile(path.join(cwd, 'package.json'), 'utf8');
    if (pkg.includes('htmx')) techStack.add('htmx');
    if (pkg.includes('react')) techStack.add('react');
  } catch (e) {}

  console.log(chalk.gray(`Detected stack: ${[...techStack].join(', ') || 'none'}`));

  // Mapping detected stack to skill folders (simplified mapping based on known repos)
  const skillsToCopy = ['critical-analysis', 'prompt-engineering']; // Core skills
  
  if (techStack.has('python')) {
    skillsToCopy.push('python-project-standards', 'test-first-patterns');
  }
  if (techStack.has('fastapi')) {
    skillsToCopy.push('claude-api-patterns', 'fastapi-patterns');
  }
  if (techStack.has('langgraph')) {
    skillsToCopy.push('langgraph-patterns');
  }

  let copiedCount = 0;

  for (const skill of skillsToCopy) {
    const srcPath = path.join(HUB_SKILLS_PATH, skill);
    const destPath = path.join(destSkillsDir, skill);

    if (existsSync(srcPath)) {
      await fs.cp(srcPath, destPath, { recursive: true, force: true });
      copiedCount++;
      console.log(chalk.gray(`  + Copied skill: ${skill}`));
    }
  }

  console.log(chalk.green(`✅ Synced ${copiedCount} skills.`));
}
