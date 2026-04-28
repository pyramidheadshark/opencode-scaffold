# Skill Developer

## When to Load This Skill

Load when: creating a new skill, modifying an existing skill, updating `skill-rules.json`, evaluating skill quality, or refactoring the skill library.

## Skill Anatomy

Every skill follows this structure:

```
.claude/skills/{skill-name}/
├── SKILL.md                  # main file — MUST be under 500 lines
└── resources/
    ├── topic-1.md            # deep-dive subsections — under 500 lines each
    └── topic-2.md
```

`SKILL.md` is the entry point. It must:
- State when to load the skill (trigger criteria)
- Provide immediately actionable patterns (not just theory)
- Reference `resources/` files for details rather than inlining everything
- Stay under 500 lines — if growing beyond this, extract to resources

## Creating a New Skill

### Step 1: Define the trigger

Ask: "What file patterns or prompt keywords make this skill relevant?"
These go into `skill-rules.json` under the skill's `triggers`.

### Step 2: Write SKILL.md

Structure:
```markdown
# {Skill Name}

## When to Load This Skill
{file patterns and keywords}

## {Core Concept or Setup}
{immediately actionable content}

## {Main Pattern 1}
{code example or steps}

## {Main Pattern 2}
{code example or steps}

## Further Resources

```

### Step 3: Register in skill-rules.json

```json
{
  "skill": "my-new-skill",
  "triggers": {
    "files": ["*.relevant-ext", "specific-file.py"],
    "keywords": ["relevant keyword", "another trigger phrase"],
    "always_load": false
  },
  "priority": 11
}
```

Priority determines load order when the 3-skill limit is reached. Lower number = higher priority.

### Step 4: Test activation

Open a test project, mention a trigger keyword, and verify the skill appears in context via the hook output.

## Quality Standards

A good skill is:
- **Actionable**: Contains copy-paste-ready code, not just descriptions
- **Specific**: Covers our actual stack (uv, FastAPI, YC, etc.) not generic patterns
- **Concise**: Every line earns its place — no padding
- **Self-contained**: Does not require reading another skill to use
- **Honest**: Notes limitations and when NOT to use the pattern

A bad skill is:
- Over 500 lines without resource extraction
- Full of prose with no code examples
- Generic (could apply to any Python project)
- Duplicating content from another skill

## Modifying an Existing Skill

1. Make changes to `SKILL.md` or the relevant resource file in `resources/`
2. If adding new trigger keywords, update `skill-rules.json`
3. If extracting content to resources, add a reference line in `SKILL.md`
4. Update `docs/CHANGELOG.md` with the change

## Skill Compression Reminder

The `skill-activation-prompt.js` hook compresses skills over 300 lines before injecting them.
Keep main `SKILL.md` under 300 lines to avoid compression and ensure full content is always available.
Resources are loaded on demand — they are not affected by the compression threshold.

## Current Skill Inventory

| Skill | Lines | Status |
|---|---|---|
| python-project-standards | ~150 | Full |
| fastapi-patterns | ~180 | Full |
| multimodal-router | ~120 | Full |
| test-first-patterns | ~160 | Full |
| ml-data-handling | ~170 | Full |
| htmx-frontend | ~160 | Full |
| langgraph-patterns | ~190 | Full |
| infra-yandex-cloud | ~190 | Full |
| design-doc-creator | ~120 | Full |
| skill-developer | this file | Full |

Update this table when adding or significantly modifying skills.
