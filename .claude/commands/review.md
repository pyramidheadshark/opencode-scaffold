# /review

Runs the code-reviewer agent on the current branch or specified files.

## Usage

```
/review                    # review all changes vs main
/review src/module/        # review specific directory
/review src/module/file.py # review specific file
```

## Instructions for Claude Code

1. Run static analysis first:
```bash
uv run ruff check . --output-format=concise
uv run mypy src/ --no-error-summary
```

2. Get changed files:
```bash
git diff --name-only main...HEAD
```

3. Read each changed file and apply the code-reviewer agent checklist
4. Produce the structured review report defined in `agents/code-reviewer.md`
5. If no files changed vs main, review the files specified in the command argument
6. If any changed file touches authentication, database queries, external API calls, or user-controlled input — append a note at the end of the review report: "Security-sensitive changes detected. Run `/security-review` for a dedicated vulnerability scan (SQL injection, XSS, auth flaws, insecure data handling)."
