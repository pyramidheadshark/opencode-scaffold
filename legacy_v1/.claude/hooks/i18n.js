'use strict';

const MESSAGES = {
  en: {
    // session-start
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

    // skill-activation-prompt
    context_refresh_title: '## [CONTEXT REFRESH]',
    context_refresh_body: `Long session detected. Core rules reminder:
- TDD: tests before code, never reverse
- Hexagonal arch: no framework imports in core/
- Commits: subject only, no AI attribution, ≤72 chars
- Plan mode required for multi-file changes`,
    plan_mode_recommended_title: '## [PLAN MODE RECOMMENDED]',
    plan_mode_recommended_body: `> 3+ Write/Edit calls without EnterPlanMode detected.
Consider entering plan mode for complex changes to maintain workflow quality.`,
    commit_rules_title: '## [COMMIT RULES]',
    commit_rules_body: `One stage = one commit. Subject line only (≤72 chars) — no body unless why is non-obvious.
NEVER add Co-Authored-By or any AI attribution. Message ends after the subject line.`,
    security_hint_title: '## [SECURITY HINT]',
    security_hint_body: `Changed files include security-sensitive code (auth/DB/API/user).
Run \`/security-review\` before committing.`,
    qa_before_plan_title: '## [QA RECOMMENDED BEFORE PLAN]',
    qa_before_plan_body: `Before entering plan mode, consider asking these clarifying questions:
1. Scope: which files/modules are in scope? What is explicitly OUT of scope?
2. Constraints: backward compatibility, deployment limits, deadlines?
3. Success criteria: how do we know this task is done?
4. Non-goals: what should we explicitly NOT do?
If the user's intent is already clear, proceed directly to EnterPlanMode.`,
    plan_mode_required_title: '## [PLAN-MODE REQUIRED]',
    plan_mode_required_body: `This prompt requires plan mode — do not skip this step.
You MUST call the EnterPlanMode tool IMMEDIATELY, before reading files, writing code, or taking any action.
Proceeding without plan mode violates CLAUDE.md workflow rules.
Steps:
1. Call EnterPlanMode tool now
2. Explore the codebase and design the implementation plan
3. Present the plan and wait for explicit user approval
4. Only then call ExitPlanMode and begin implementation`,
    pitfalls_title: '## [PITFALLS — Relevant]',

    // session-checkpoint
    checkpoint_plan_header: '## [AUTO CHECKPOINT — Plan Approved]',
    checkpoint_plan_status_instructions: `The plan was just approved (ExitPlanMode called). Before starting implementation,
write dev/status.md:
- Active phase marker
- What is about to be implemented
- Key architectural decisions from the plan
- Open questions / blockers`,
    compact_required_header: '## [BEFORE STARTING IMPLEMENTATION]',
    compact_required_body: `Before executing Step 1, update dev/status.md with:
- Active phase + what is being implemented
- Key architectural decisions from the plan
- Open questions / blockers

If the context window is running low, click the **"Clear context"** button
in the Claude Code UI before starting — the plan file will survive the clear.
Write a brief resume note in dev/status.md first so you can resume smoothly.`,
    threshold_header: '## [AUTO CHECKPOINT — Context Critical]',
    threshold_body: (pct) => `Context at ${pct}% remaining. Before your next response,
update dev/status.md with current progress, decisions made, and next steps.`,
    context_warning_header: '## [CONTEXT WARNING]',
    context_warning_body: `Ask the user to click the **"Clear context"** button in the Claude Code UI, or run /compact. Write a brief resume note in dev/status.md first so you can resume smoothly.`,
    deps_blockers_header: '## [OPEN BLOCKERS REMINDER]',
    deps_blockers_footer: '\nConsider addressing these blockers or updating their status.',

    // session-start — model conflict
    model_conflict_title: '## [MODEL CONFLICT]',
    model_conflict_body: (envModel, projectModel) =>
      `\`ANTHROPIC_MODEL=${envModel}\` in your shell overrides project model \`${projectModel}\` from .claude/settings.json.\n` +
      `To use the project model for this repo, unset the env var:\n` +
      `  unset ANTHROPIC_MODEL   # bash/zsh\n` +
      `  Remove-Item Env:ANTHROPIC_MODEL   # PowerShell\n` +
      `Then restart Claude Code.`,
  },

  ru: {
    // session-start
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

    // skill-activation-prompt
    context_refresh_title: '## [ОБНОВЛЕНИЕ КОНТЕКСТА]',
    context_refresh_body: `Длинная сессия. Напоминание основных правил:
- TDD: тесты до кода, никогда наоборот
- Гексагональная архитектура: никаких импортов фреймворков в core/
- Коммиты: только тема, без AI-атрибуции, ≤72 символа
- Для изменений в нескольких файлах — обязательно plan mode`,
    plan_mode_recommended_title: '## [РЕКОМЕНДУЕТСЯ ПЛАН-РЕЖИМ]',
    plan_mode_recommended_body: `> Обнаружено 3+ вызовов Write/Edit без EnterPlanMode.
Рассмотри вход в план-режим для сложных изменений, чтобы сохранить качество рабочего процесса.`,
    commit_rules_title: '## [ПРАВИЛА КОММИТОВ]',
    commit_rules_body: `Один этап = один коммит. Только строка темы (≤72 символа) — без тела, если «почему» очевидно из diff.
НИКОГДА не добавляй Co-Authored-By или AI-атрибуцию. Сообщение заканчивается после строки темы.`,
    security_hint_title: '## [ПОДСКАЗКА БЕЗОПАСНОСТИ]',
    security_hint_body: `Изменённые файлы включают чувствительный код (auth/DB/API/user).
Перед коммитом выполни \`/security-review\`.`,
    qa_before_plan_title: '## [QA ПЕРЕД ПЛАНИРОВАНИЕМ]',
    qa_before_plan_body: `Прежде чем входить в план-режим, задай уточняющие вопросы:
1. Scope: какие файлы/модули в зоне задачи? Что явно НЕ входит в scope?
2. Ограничения: обратная совместимость, ограничения деплоя, дедлайны?
3. Критерии готовности: как понять, что задача выполнена?
4. Не-цели: что явно НЕ нужно делать?
Если намерение пользователя уже понятно — сразу вызови EnterPlanMode.`,
    plan_mode_required_title: '## [ОБЯЗАТЕЛЕН ПЛАН-РЕЖИМ]',
    plan_mode_required_body: `Этот промпт требует план-режима — не пропускай этот шаг.
Ты ОБЯЗАН немедленно вызвать инструмент EnterPlanMode — до чтения файлов, написания кода и любых действий.
Работа без план-режима нарушает правила CLAUDE.md.
Шаги:
1. Немедленно вызови инструмент EnterPlanMode
2. Изучи кодовую базу и разработай план реализации
3. Представь план и дождись явного одобрения пользователя
4. Только после этого вызови ExitPlanMode и начни реализацию`,
    pitfalls_title: '## [ПОДВОДНЫЕ КАМНИ — Релевантные]',

    // session-checkpoint
    checkpoint_plan_header: '## [АВТО-ЧЕКПОИНТ — План утверждён]',
    checkpoint_plan_status_instructions: `План только что утверждён (вызван ExitPlanMode). Перед началом реализации обнови dev/status.md:
- Маркер активной фазы
- Что именно будет реализовано
- Ключевые архитектурные решения из плана
- Открытые вопросы / блокеры`,
    compact_required_header: '## [ПЕРЕД НАЧАЛОМ РЕАЛИЗАЦИИ]',
    compact_required_body: `Перед выполнением Шага 1 обнови dev/status.md:
- Активная фаза + что именно реализуется
- Ключевые архитектурные решения из плана
- Открытые вопросы / блокеры

Если контекст заканчивается, нажми кнопку **"Clear context"** в интерфейсе Claude Code
перед стартом — файл плана сохранится. Сначала напиши краткую заметку для возобновления
в dev/status.md, чтобы продолжить с точки остановки.`,
    threshold_header: '## [АВТО-ЧЕКПОИНТ — Критический контекст]',
    threshold_body: (pct) => `Осталось ${pct}% контекстного окна. Перед следующим ответом обнови dev/status.md: текущий прогресс, принятые решения, следующие шаги.`,
    context_warning_header: '## [ПРЕДУПРЕЖДЕНИЕ КОНТЕКСТА]',
    context_warning_body: `Попроси пользователя нажать кнопку **"Clear context"** в интерфейсе Claude Code или запустить /compact. Сначала напиши краткую заметку для возобновления в dev/status.md.`,
    deps_blockers_header: '## [НАПОМИНАНИЕ ОБ ОТКРЫТЫХ БЛОКЕРАХ]',
    deps_blockers_footer: '\nРассмотри устранение этих блокеров или обновление их статуса.',

    // session-start — model conflict
    model_conflict_title: '## [КОНФЛИКТ МОДЕЛИ]',
    model_conflict_body: (envModel, projectModel) =>
      `\`ANTHROPIC_MODEL=${envModel}\` в shell перекрывает модель проекта \`${projectModel}\` из .claude/settings.json.\n` +
      `Чтобы использовать модель проекта для этого репо, сбрось env-переменную:\n` +
      `  unset ANTHROPIC_MODEL   # bash/zsh\n` +
      `  Remove-Item Env:ANTHROPIC_MODEL   # PowerShell\n` +
      `Затем перезапусти Claude Code.`,
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

function buildContextRefreshBlock(lang) {
  const m = getMessages(lang);
  return `${m.context_refresh_title}\n${m.context_refresh_body}`;
}

function buildPlanModeRecommendedBlock(lang) {
  const m = getMessages(lang);
  return `${m.plan_mode_recommended_title}\n${m.plan_mode_recommended_body}`;
}

function buildCommitRulesBlock(lang) {
  const m = getMessages(lang);
  return `${m.commit_rules_title}\n${m.commit_rules_body}`;
}

function buildSecurityHintBlock(lang) {
  const m = getMessages(lang);
  return `${m.security_hint_title}\n${m.security_hint_body}`;
}

function buildQaBeforePlanBlock(lang) {
  const m = getMessages(lang);
  return `${m.qa_before_plan_title}\n${m.qa_before_plan_body}`;
}

function buildPlanModeRequiredBlock(lang) {
  const m = getMessages(lang);
  return `${m.plan_mode_required_title}\n${m.plan_mode_required_body}`;
}

function buildCheckpointPlanBlock(lang) {
  const m = getMessages(lang);
  return `${m.checkpoint_plan_header}\n${m.checkpoint_plan_status_instructions}\n\n` +
    `${m.compact_required_header}\n${m.compact_required_body}`;
}

function buildThresholdCheckpointBlock(pct, lang) {
  const m = getMessages(lang);
  return `${m.threshold_header}\n${m.threshold_body(pct)}\n\n` +
    `${m.context_warning_header}\n${m.context_warning_body}`;
}

function buildDepsBrockersBlock(blockers, lang) {
  const m = getMessages(lang);
  return m.deps_blockers_header + '\n' +
    blockers.map(b => `- [${b.id}] ${b.description || 'no description'}`).join('\n') +
    m.deps_blockers_footer;
}

function buildModelConflictBlock(envModel, projectModel, lang) {
  const m = getMessages(lang);
  return `${m.model_conflict_title}\n${m.model_conflict_body(envModel, projectModel)}`;
}

module.exports = {
  getMessages,
  buildOnboardingBlock,
  buildWindowsRulesBlock,
  buildContextRefreshBlock,
  buildPlanModeRecommendedBlock,
  buildCommitRulesBlock,
  buildSecurityHintBlock,
  buildQaBeforePlanBlock,
  buildPlanModeRequiredBlock,
  buildCheckpointPlanBlock,
  buildThresholdCheckpointBlock,
  buildDepsBrockersBlock,
  buildModelConflictBlock,
  MESSAGES,
};
