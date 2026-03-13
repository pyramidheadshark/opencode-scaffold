# Contributing to claude-scaffold

Thank you for your interest in improving claude-scaffold. This document covers conventions for contributing new skills, fixing bugs, and extending the system.

---

## Ways to Contribute

- **Add a skill** — new domain (e.g. `golang-patterns`, `dbt-analytics`)
- **Improve an existing skill** — better examples, updated API docs, richer resources
- **Fix a hook bug** — session-start, skill-activation, or quality-check hooks
- **Add a CI profile** — new stack combination in `templates/github-actions/`
- **Translations** — skill content or docs in additional languages

---

## Skill Conventions

Each skill lives in `.claude/skills/<skill-name>/` with this structure:

```
.claude/skills/<skill-name>/
├── SKILL.md              # main content (keep under 300 lines)
├── skill-metadata.json   # version, updated, size_lines, resources[]
└── resources/            # optional subsections for progressive disclosure
    └── topic.md
```

### SKILL.md rules

- No comments inside code blocks — all explanations go before or after
- Type hints in all Python examples
- Keep under 300 lines — use `resources/` for overflow
- Trigger keywords must be specific enough to avoid false positives

### skill-metadata.json format

```json
{
  "version": "1.0.0",
  "updated": "YYYY-MM-DD",
  "size_lines": 120,
  "resources": ["resources/topic-a.md"]
}
```

### Trigger rules

Add your skill to `.claude/skills/skill-rules.json`:

```json
{
  "name": "my-skill",
  "triggers": {
    "keywords": ["keyword1", "keyword2"],
    "file_patterns": ["**/*.ext"]
  },
  "min_keyword_matches": 1
}
```

Use `min_keyword_matches: 2` for generic keywords that might false-trigger (e.g. `terraform`, `graph`).

---

## Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Run all tests before making changes
npm run test:hook
python tests/infra/test_infra.py

# 3. Make your changes

# 4. Verify line budget
npm run check:budget

# 5. Run tests again
npm run test:hook
python tests/infra/test_infra.py

# 6. Commit with Conventional Commits
git commit -m "feat: add golang-patterns skill"
```

---

## Commit Convention

```
feat: add golang-patterns skill
fix: correct langgraph trigger keyword regex
test: add infra test for new skill structure
docs: update INTEGRATION.md with new CLI flags
chore: upgrade jest to 30.x
```

---

## Adding Tests

- New skill → add a structural test in `tests/infra/test_infra.py` (see existing skill tests as reference)
- New hook logic → add a Jest test in `tests/hook/`
- New CLI command (Phase 1+) → add a test in `tests/cli/`

All PRs must keep the existing test suite green.

---

## Questions

Open an issue if you're unsure about scope or approach before starting a large contribution.
