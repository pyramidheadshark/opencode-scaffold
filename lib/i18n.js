'use strict';

const MESSAGES = {
  en: {
    onboarding_title: '## Project Onboarding Required',
    onboarding_body: `First Claude Code session detected. Ask the user these questions before starting work:
1. Main goal of this session?
2. Which files or modules are in scope today?
3. Any blockers or known issues from previous work?
4. Any project-specific constraints beyond CLAUDE.md?
5. Preferred response language for this project?
Save key answers to .claude/project-config.json.`,
    windows_title: '## Windows Compatibility Rules',
    windows_body: `Platform is win32. Apply to ALL generated code and terminal instructions:
1. Python command: use \`python\` (not \`python3\`). Detected python_cmd is saved in .claude/project-config.json.
2. Shell: Claude Code Bash tool runs in Git Bash — use Unix syntax for tool calls. For user-facing terminal commands in docs/README/scripts, always provide PowerShell syntax.
3. Encoding: ALWAYS specify encoding explicitly in all file I/O:
   - Python: \`open(..., encoding="utf-8")\` and \`Path(...).read_text(encoding="utf-8")\`
   - Never use bare \`open()\` without encoding — Windows defaults to cp1251/cp1252 which corrupts UTF-8 files
4. Terminal encoding: run \`chcp 65001\` before starting Claude Code in CMD/PowerShell, or add to PowerShell profile: \`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\`. Recommended: launch Claude Code from Git Bash to avoid encoding issues entirely.`,
  },

  ru: {
    onboarding_title: '## Требуется онбординг проекта',
    onboarding_body: `Обнаружена первая сессия Claude Code. Перед началом работы задай пользователю эти вопросы:
1. Основная цель этой сессии?
2. Какие файлы или модули в scope сегодня?
3. Есть ли блокеры или известные проблемы из предыдущей работы?
4. Есть ли специфичные ограничения проекта помимо CLAUDE.md?
5. Предпочтительный язык ответов для этого проекта?
Сохрани ключевые ответы в .claude/project-config.json.`,
    windows_title: '## Правила совместимости с Windows',
    windows_body: `Платформа win32. Применяй ко ВСЕМУ генерируемому коду и командам терминала:
1. Команда Python: используй \`python\` (не \`python3\`). Определённый python_cmd сохранён в .claude/project-config.json.
2. Shell: инструмент Bash в Claude Code работает в Git Bash — используй Unix-синтаксис для вызовов инструментов. В пользовательских командах (docs/README/скрипты) всегда давай PowerShell-синтаксис.
3. Кодировка: ВСЕГДА указывай кодировку явно во всех файловых операциях:
   - Python: \`open(..., encoding="utf-8")\` и \`Path(...).read_text(encoding="utf-8")\`
   - Никогда не используй голый \`open()\` без кодировки — Windows по умолчанию использует cp1251/cp1252, что портит UTF-8 файлы
4. Кодировка терминала: запусти \`chcp 65001\` перед стартом Claude Code в CMD/PowerShell, или добавь в PowerShell profile: \`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\`. Рекомендуется: запускать Claude Code из Git Bash.`,
  },
};

function getMessages(lang) {
  return MESSAGES[lang] || MESSAGES.en;
}

function buildOnboardingBlock(lang) {
  const m = getMessages(lang);
  return `${m.onboarding_title}\n${m.onboarding_body}`;
}

function buildWindowsRulesBlock(lang) {
  const m = getMessages(lang);
  return `${m.windows_title}\n${m.windows_body}`;
}

module.exports = { getMessages, buildOnboardingBlock, buildWindowsRulesBlock, MESSAGES };
