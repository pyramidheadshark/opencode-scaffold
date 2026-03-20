# Org Profiles

This directory contains team-specific CLAUDE.md templates that are deployed alongside the base scaffold profile.

## Structure

```
org-profiles/
└── <org-name>/
    ├── profile.json          # org metadata + project_types registry
    ├── repos.json            # list of repos in this org (for update-org-profile)
    └── templates/
        └── <project-type>/
            ├── CLAUDE.md.en  # English CLAUDE.md template
            └── CLAUDE.md.ru  # Russian CLAUDE.md template
```

## Usage

```bash
# Deploy with org profile
npx claude-scaffold init /path/to/repo --profile ai-developer --org-profile <org-name> --org-type <type>

# List available org profiles
npx claude-scaffold list-org-profiles

# Update all repos in an org
npx claude-scaffold update-org-profile --org <org-name>
```

## Notes

- Org profile directories are gitignored — they contain team-specific and potentially sensitive content
- Add your org directory to `.gitignore` if sharing this scaffold publicly
- See `lib/commands/org-profile.js` for the full API
