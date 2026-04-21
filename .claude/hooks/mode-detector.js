"use strict";

const MODE_PATTERNS = {
  economy:     /(эконом(?:ны(?:й|м|е)|ом|ный режим)|в экономн[оы]м|switch to economy|economy mode|переходим на (?:хайку|haiku)|все на хайку|всё на хайку|cheap mode)/i,
  'no-sonnet': /(no-?sonnet|без сонета|без соннета|переключи на опус|убери сонет|убери сонне?т|режим без сонета)/i,
  default:     /(обычны(?:й|м) режим|default mode|на сонет|sonnet mode|верни сонет|обратно на сонет|нормальн(?:ый|ом) режим)/i,
};

const TRANSIENT_PATTERNS = [
  /делаем задачу в (экономн[оа-я]+|no-?sonnet|default) режим/i,
  /прост[оа-я]* на (хайку|опус|сонет) для этой задачи/i,
  /task in (economy|no-?sonnet|default) mode/i,
  /(?:just|только) (?:this|эт[оа][гй][оа]) (task|задач[ау]) (?:in|в) (economy|no-?sonnet|default)/i,
];

function detectMode(prompt) {
  if (!prompt || typeof prompt !== "string") return null;
  const text = prompt.trim();
  if (!text) return null;

  for (const [mode, regex] of Object.entries(MODE_PATTERNS)) {
    if (regex.test(text)) {
      const transient = TRANSIENT_PATTERNS.some(r => r.test(text));
      return { mode, transient };
    }
  }
  return null;
}

function buildModeSwitchBlock(detection, lang) {
  const { mode, transient } = detection;
  if (lang === "ru") {
    if (transient) {
      return `## [ОБНАРУЖЕН ВЫБОР РЕЖИМА — на одну задачу]
Пользователь хочет выполнить **эту конкретную задачу** в режиме \`${mode}\`, но не переключаться постоянно.

Действия:
1. Используй slash-команду Claude Code \`/model\` для смены модели **только в текущей сессии**:
   - \`economy\` → \`/model claude-haiku-4-5-20251001\`
   - \`no-sonnet\` → \`/model claude-opus-4-6\` (если репо имеет base_profile=power) или \`/model claude-haiku-4-5-20251001\`
   - \`default\` → \`/model claude-sonnet-4-6\`
2. Выполни задачу
3. После завершения **напомни** пользователю, что модель в текущей сессии временная — для возврата: \`/model\` без аргумента сбросит до project default`;
    }
    return `## [ОБНАРУЖЕН ПЕРЕХОД В РЕЖИМ ${mode.toUpperCase()}]
Пользователь хочет **постоянно** переключить режим на \`${mode}\` для всех репо.

Действия:
1. Подтверди у пользователя: «Переключить все репо в \`${mode}\` режим? Это изменит \`.claude/settings.json\` во всех 30 зарегистрированных репо.»
2. Если подтверждение получено — выполни через Bash:
   \`\`\`
   claude-scaffold mode ${mode}
   \`\`\`
3. После выполнения **предупреди пользователя**: «Текущая Claude Code сессия продолжит использовать старую модель. Для применения нового режима — перезапусти сессию (закрой окно и открой заново).»
4. Если пользователь хочет **только этот репо** — используй: \`claude-scaffold mode set-profile <power|standard|balanced> <repo-path>\` и применяй нужный режим локально`;
  }
  if (transient) {
    return `## [MODE CHOICE DETECTED — transient, for this task only]
User wants **this specific task** in \`${mode}\` mode without switching globally.

Actions:
1. Use Claude Code slash command \`/model\` for current-session model swap:
   - \`economy\` → \`/model claude-haiku-4-5-20251001\`
   - \`no-sonnet\` → \`/model claude-opus-4-6\` (if base_profile=power) or \`/model claude-haiku-4-5-20251001\`
   - \`default\` → \`/model claude-sonnet-4-6\`
2. Perform the task
3. After finishing, **remind** the user this is session-local — \`/model\` with no arg resets to project default`;
  }
  return `## [MODE SWITCH DETECTED → ${mode.toUpperCase()}]
User wants to **persistently** switch to \`${mode}\` across all repos.

Actions:
1. Confirm with user: "Switch all repos to \`${mode}\` mode? This rewrites \`.claude/settings.json\` in all 30 registered repos."
2. On confirmation — run via Bash:
   \`\`\`
   claude-scaffold mode ${mode}
   \`\`\`
3. After switching, **warn the user**: "Current Claude Code session keeps the old model. Restart session (close & reopen) to apply the new mode."
4. If the user wants a **single repo** only — use: \`claude-scaffold mode set-profile <power|standard|balanced> <repo-path>\``;
}

module.exports = {
  MODE_PATTERNS,
  TRANSIENT_PATTERNS,
  detectMode,
  buildModeSwitchBlock,
};
