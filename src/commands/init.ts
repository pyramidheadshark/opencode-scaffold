import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

import { syncSkillsCommand } from './skills.js';

export async function initCommand(options: { yes?: boolean }) {
  console.log(chalk.cyan.bold('\n🚀 Initializing opencode-scaffold v2.0...\n'));

  // 1. Gather User Preferences
  const answers = options.yes
    ? {
        enableWeb: true,
        enableMemoryBank: true,
        installOhMyOpenCode: true,
      }
    : await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enableWeb',
          message: 'Enable native web search & fetch by default?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'enableMemoryBank',
          message: 'Set up Memory Bank architecture (prevents context amnesia)?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'installOhMyOpenCode',
          message: 'Install oh-my-opencode-slim plugin for sub-agent orchestration?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'setupPreCommit',
          message: 'Setup Python/JS pre-commit hooks (.pre-commit-config.yaml)?',
          default: true,
        }
      ]);

  const cwd = process.cwd();
  const openCodeDir = path.join(cwd, '.opencode');

  // 2. Create Base Directories
  console.log(chalk.gray('Creating directories...'));
  await fs.mkdir(path.join(openCodeDir, 'agents', 'prompts'), { recursive: true });
  await fs.mkdir(path.join(openCodeDir, 'skills'), { recursive: true });
  
  if (answers.enableMemoryBank) {
    await fs.mkdir(path.join(openCodeDir, 'memory-bank'), { recursive: true });
  }

  // 3. Create Global Config
  const scaffoldConfig = {
    version: '2.0',
    features: answers,
    lastInit: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(cwd, '.opencode-scaffold.json'),
    JSON.stringify(scaffoldConfig, null, 2)
  );

  // 4. Setup OpenCode Config (.opencode/config.json)
  const ocConfig: any = {
    model: 'google/gemini-3.1-pro-preview',
    plugins: []
  };
  
  if (answers.installOhMyOpenCode) {
    ocConfig.plugins.push('oh-my-opencode-slim');
    ocConfig.plugins.push('@tarquinen/opencode-dcp');
  }

  if (answers.enableWeb) {
    ocConfig.default_permissions = 'websearch,webfetch,bash,read,edit,glob,grep';
  } else {
    ocConfig.default_permissions = 'bash,read,edit,glob,grep';
  }

  await fs.writeFile(
    path.join(openCodeDir, 'config.json'),
    JSON.stringify(ocConfig, null, 2)
  );

  // 5. Generate Gold Prompts & Agents
  await generateAgents(openCodeDir);

  // 6. Generate Memory Bank
  if (answers.enableMemoryBank) {
    await generateMemoryBank(openCodeDir);
  }

  // 7. Generate Pre-Commit Hooks
  if (answers.setupPreCommit || options.yes) {
    await generatePreCommitHooks(cwd);
  }

  // 8. Sync Skills
  await syncSkillsCommand();

  // 9. Inject Plugins into package.json (if it exists)
  if (answers.installOhMyOpenCode) {
    const pkgPath = path.join(cwd, 'package.json');
    try {
      const pkgRaw = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgRaw);
      pkg.devDependencies = pkg.devDependencies || {};
      
      if (answers.installOhMyOpenCode) {
        pkg.devDependencies['oh-my-opencode-slim'] = '^1.0.0';
        pkg.devDependencies['@tarquinen/opencode-dcp'] = '^1.0.0';
      }

      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
      console.log(chalk.gray('Injected dependencies into package.json'));
    } catch (e) {
      console.log(chalk.yellow('No package.json found. Please install plugins manually.'));
    }
  }

  console.log(chalk.green.bold('\n? opencode-scaffold successfully initialized!\n'));
  console.log(chalk.white('Next steps:'));
  if (answers.installOhMyOpenCode) {
    console.log(chalk.yellow('  npm install'));
  }
  if (answers.setupPreCommit || options.yes) {
    console.log(chalk.yellow('  pre-commit install'));
  }
  console.log(chalk.yellow('  opencode --system-prompt-file .opencode/OPENCODE.md'));
}

async function generateAgents(baseDir: string) {
  const agentsDir = path.join(baseDir, 'agents');
  const promptsDir = path.join(agentsDir, 'prompts');

  const agents = [
    {
      id: 'architect',
      name: 'Architect',
      mode: 'primary',
      model: 'google/gemini-3.1-pro-preview',
      desc: 'Главный архитектор системы',
      prompt: 'You are a senior ML engineer specializing in complex, production-grade systems. Your defining trait is a pragmatic and critical approach. You are not just an executor — you are an intellectual partner whose goal is to create the best, most reliable, and most scalable solution. You always think several steps ahead. Follow TDD, Hexagonal Architecture, and never hardcode secrets.\n\nBEFORE finishing any task, use the edit tool to update .opencode/memory-bank/activeContext.md and progress.md. Internet usage is strictly read-only for documentation (webfetch). Never execute piped scripts (curl | bash) from the internet.'
    },
    {
      id: 'qa_engineer',
      name: 'QA Engineer',
      mode: 'subagent',
      model: 'moonshotai/kimi-k2.6',
      desc: 'Суровый QA-Инженер для E2E тестов',
      prompt: 'You are a strict QA automation engineer. Write Pytest/Playwright E2E tests for the provided code. Do not write features. Run the tests via bash. If tests fail, analyze the stack trace and return a structured defect report. You have 3 max retries to fix test environments.'
    },
    {
      id: 'security_sentinel',
      name: 'Security Sentinel',
      mode: 'subagent',
      model: 'z-ai/glm-5-turbo',
      desc: 'Аналитик безопасности (Ищет уязвимости)',
      prompt: 'You are a Security Sentinel reviewing a proposed technical decision. Your sole purpose is to find vulnerabilities, injection risks, leaky abstractions, and supply chain flaws in the code. Read the provided diff and output ONLY security risks.'
    },
    {
      id: 'performance_analyst',
      name: 'Performance Analyst',
      mode: 'subagent',
      model: 'z-ai/glm-5-turbo',
      desc: 'Аналитик производительности (Big-O, утечки)',
      prompt: 'You are a Performance Analyst. Review the proposed changes for Big-O complexity flaws, memory leaks, and N+1 query problems. Suggest performance optimizations.'
    }
  ];

  for (const agent of agents) {
    // Write prompt
    const promptPath = path.join(promptsDir, `${agent.id}.txt`);
    await fs.writeFile(promptPath, agent.prompt);

    // Write agent markdown
    const mdContent = `---
description: ${agent.desc}
prompt: ./prompts/${agent.id}.txt
model: ${agent.model}
mode: ${agent.mode}
permissions: bash, read, edit, glob, grep, webfetch
hidden: false
---
`;
    await fs.writeFile(path.join(agentsDir, `${agent.id}.md`), mdContent);
  }

  // Generate OPENCODE.md default entry prompt that points to the Architect
  const mainPrompt = `<memory_bank_rules>
You have a Memory Bank in the \`.opencode/memory-bank/\` directory. 
It is your persistent memory. ALWAYS update \`activeContext.md\` and \`progress.md\` before finishing a task.
Consult \`systemContext.md\` before making architectural decisions.
</memory_bank_rules>

<orchestration_rules>
You have access to sub-agents via the 'oh-my-opencode-slim' plugin.
When a task is complex or requires deep testing, use the \`delegateTask_Background\` tool to assign it to a sub-agent (e.g., QA Engineer, Security Sentinel). Let them work in the background and only return the summary to you to save your context window.
</orchestration_rules>

You are the Architect agent. Please read .opencode/memory-bank/projectbrief.md to begin.
`;
  await fs.writeFile(path.join(baseDir, 'OPENCODE.md'), mainPrompt);
}

async function generateMemoryBank(baseDir: string) {
  const mbDir = path.join(baseDir, 'memory-bank');
  
  const files = {
    'projectbrief.md': '# Project Brief\nDefine core business requirements and goals here.',
    'productContext.md': '# Product Context\nDescribe the UX, personas, and how it should work.',
    'systemContext.md': '# System Context\nDescribe Architecture, Tech Stack (e.g., Python/FastAPI), and patterns.',
    'activeContext.md': '# Active Context\nWhat is the current focus? What are we building right now?',
    'progress.md': '# Progress\nChange log, known bugs, completed tasks, and next steps.'
  };

  for (const [filename, content] of Object.entries(files)) {
    await fs.writeFile(path.join(mbDir, filename), content);
  }
}

async function generatePreCommitHooks(cwd: string) {
  const content = `repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: [ --fix ]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v9.0.0
    hooks:
      - id: eslint
        additional_dependencies:
          - eslint
          - typescript
          - typescript-eslint
        types: [javascript, typescript]
  - repo: local
    hooks:
      - id: tests
        name: AI Verification Tests (pytest or npm test)
        entry: bash -c "if [ -f package.json ]; then npm test; else pytest tests/; fi"
        language: system
        pass_filenames: false
`;
  await fs.writeFile(path.join(cwd, '.pre-commit-config.yaml'), content);
}
