# /mode-switch

Switch claude-scaffold model routing mode across all registered repos.

Use this slash command as an explicit alternative to natural-language detection.
If the user says things like "переходим в экономный режим" or "switch to economy mode"
the `mode-detector.js` hook will catch it automatically; this slash command is the
fallback when the detector misses or the user prefers explicit invocation.

## Available modes

| Mode | power repos | standard repos | balanced repos | When to use |
|------|-------------|----------------|----------------|-------------|
| `default` | Sonnet 4.6 | Haiku 4.5 | Sonnet 4.6 | Regular development |
| `economy` | Haiku 4.5 | Haiku 4.5 | Haiku 4.5 | Sonnet quota draining, simple tasks |
| `no-sonnet` | **Opus 4.6** | Haiku 4.5 | Haiku 4.5 | Sonnet unavailable, critical hub decisions need Opus |

## Instructions for Claude Code

When the user invokes `/mode-switch`, they may provide the target mode as an argument
(e.g. `/mode-switch economy`). If no argument is given, ask which mode they want.

### Steps

1. **Determine target mode**: read it from the `/mode-switch <mode>` argument, or ask
   the user if missing. Valid values: `default`, `economy`, `no-sonnet`.
2. **Ask for confirmation**: show a brief preview — "This will rewrite
   `.claude/settings.json` across all 30 registered repos. Proceed?"
3. **On confirmation**, run via Bash:
   ```
   claude-scaffold mode <mode>
   ```
4. **After switching**, warn the user explicitly:
   - "The active Claude Code session still uses the old model. Close and reopen
     the session to apply the new mode."
   - "Per-repo overrides can be set with `claude-scaffold mode set-profile
     <power|standard|balanced> <repo-path>` before re-running this command."
5. **Check quota** after switching: suggest `claude-scaffold quota status` to
   verify usage and budget alignment for the new mode.

### Transient (single-task) model change

If the user wants a one-off model change **only for the current task** (not
persistent), do **not** run `claude-scaffold mode`. Instead use Claude Code's
session-local `/model` slash command:

- economy → `/model claude-haiku-4-5-20251001`
- no-sonnet → `/model claude-opus-4-6` (if base_profile=power) or `/model claude-haiku-4-5-20251001`
- default → `/model claude-sonnet-4-6`

After the task, remind the user `/model` with no argument resets to project default.

## Related commands

- `claude-scaffold mode status` — show active mode and drift
- `claude-scaffold mode auto-assign` — assign base profiles by repo-name heuristics
- `claude-scaffold mode set-profile <profile> <path>` — per-repo override
- `claude-scaffold quota status` — weekly quota from ccusage
