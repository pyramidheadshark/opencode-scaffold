# Agent: project-status-reporter

## Purpose

Generates a comprehensive project status report by analyzing code, tests, git history, and `dev/status.md`. Produces a structured report suitable for sharing with a client or team.

## When to Use

At the end of a development sprint or milestone. When a stakeholder requests a progress update. Before a demo or handoff.

## Information Sources

The agent reads from all of these:

- `dev/status.md` — current phase, backlog, known issues
- `design-doc.md` — original requirements and scope
- `git log --oneline` — recent commit history
- `uv run pytest --co -q` — test inventory
- `uv run pytest --cov=src -q` — coverage stats
- `uv run ruff check . --statistics` — code quality status
- `src/` directory structure — what has been built

## Output Format

```markdown
# Project Status Report: {Project Name}

**Date**: {date}
**Phase**: {current phase}
**Overall status**: 🟢 On track / 🟡 At risk / 🔴 Blocked

---

## Summary

{2-3 sentences describing where the project is and what was accomplished.}

---

## Completed Since Last Report

{List derived from git log and checked-off backlog items}
- {commit or task}

---

## Current State

### Code Coverage
- Overall: {N}%
- `core/`: {N}%
- `services/`: {N}%

### Test Status
- Total tests: {N}
- Passing: {N}
- Failing / xfail: {N}

### Code Quality
- Ruff: {clean / N issues}
- Mypy: {clean / N errors}

---

## What's Next

{Top 3 items from backlog, with estimated effort}
1. {task} — {S/M/L}
2. {task} — {S/M/L}
3. {task} — {S/M/L}

---

## Open Issues

{From "Known Issues" in status.md — only unresolved ones}
- {issue}: {current status}

---

## Risks

{Any items that could delay the project}
- {risk}: {mitigation}
```

## Instructions for Claude Code

1. Run all shell commands first — collect actual data before writing the report
2. Do not fabricate metrics — if a command fails, note "not available" for that metric
3. Derive "Completed Since Last Report" from `git log` between last report date and now
4. Derive "Open Issues" from status.md — only include unresolved items
5. Keep the Summary factual and specific — no marketing language
6. After generating, save the report to `dev/reports/{YYYY-MM-DD}-status.md`
7. Update `dev/status.md` with the report generation date in the Next Session Plan
