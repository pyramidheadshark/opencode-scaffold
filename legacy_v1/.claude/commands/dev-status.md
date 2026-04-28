# /dev-status

Updates `dev/status.md` to reflect the current state of the project.

Run this command:
- Before ending any work session
- After completing a significant task
- When switching focus to a different part of the project

## What to Update

1. Check off completed backlog items
2. Move the active phase marker if a phase was completed
3. Add any new issues discovered and their solutions
4. Log any architectural decisions made
5. Update "Next Session Plan" with the 2-3 most important next actions
6. Update "Files to Know" if new critical files were added

## Instructions for Claude Code

Read the current `dev/status.md`, then update it by:

1. Comparing the completed tasks list against what was actually done this session
2. Adding new items to "Known Issues and Solutions" if any blockers were hit
3. Recording any new architecture decisions in the decisions table
4. Writing a concrete "Next Session Plan" — not vague, but specific actionable steps
5. Updating the "Last updated" timestamp

Keep the file concise. If "Completed" items list grows beyond 15 items, archive the oldest ones to `dev/archive/status-{date}.md`.

Never summarize away the "Known Issues and Solutions" section — this is the most valuable part for future sessions.
