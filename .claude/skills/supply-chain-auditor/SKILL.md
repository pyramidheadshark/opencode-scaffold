# Skill: Supply Chain Auditor

## When to Load

Auto-load when: adding dependencies, reviewing packages, updating versions, or discussing `requirements.txt`, `pyproject.toml`, `package.json`. Triggers on `dependency`, `install`, `package`, `CVE`, `audit`, `vulnerable` (≥2 keywords).

## Core Rules

Every new dependency addition must pass this checklist before merging:

1. **Pinned** — exact version in production (`==1.2.3` for pip, `"1.2.3"` for npm, not `^` or `~`).
2. **Maintained** — last commit within 12 months. Abandoned packages accumulate unpatched CVEs.
3. **Necessary** — can this be replaced by stdlib or an already-present dependency?
4. **Vetted** — check PyPI/npm advisory database for known CVEs.

## Pre-Dependency Checklist

Before adding any new package:

```
[ ] Does stdlib cover this? (json, csv, pathlib, urllib, dataclasses...)
[ ] Is it already a transitive dependency we can promote?
[ ] Last release date < 12 months ago
[ ] Download count > 10k/month (ecosystem signal, not guarantee)
[ ] No open CVEs with CVSS >= 7.0 in last 2 years
[ ] Version pinned exactly in requirements.txt / pyproject.toml
[ ] Added to lockfile (uv.lock / package-lock.json / poetry.lock)
```

## Anti-Patterns — Block on Detection

| Anti-Pattern | Risk | Required Action |
|---|---|---|
| Unpinned version (`>=`, `^`, `~`, `*`) in prod | Unexpected breaking update or CVE introduced silently | Pin exact version |
| `pip install latest` / `npm install pkg` without version | Non-reproducible builds | Specify version, commit lockfile |
| Package with no recent activity (> 2 years no commits) | Unpatched vulnerabilities accumulate | Find maintained alternative |
| Dependency with known CVE | Direct security risk | Upgrade to patched version or replace |
| Pulling in package only for one utility function | Bloat, supply chain surface | Inline the function (if < 20 lines) |
| `curl | bash` install pattern | Arbitrary code execution | Use package manager with integrity check |

## Audit Commands

Run before adding dependencies or before release:

```bash
pip-audit                           # Python: checks PyPI advisory DB
pip-audit --requirement requirements.txt
safety check                        # alternative Python auditor

npm audit                           # Node.js
npm audit --audit-level=high        # block only high/critical

uv lock --check                     # verify lockfile is up to date
```

## Quick Mode Format

When this skill is active, append to dependency-related analysis:

```
[SupplyChain]: BLOCK|WARN|CLEAR — [specific risk] -> [action required]
```

Examples:
- `[SupplyChain]: BLOCK — requests>=2.0 is unpinned in production requirements -> pin to requests==2.32.3`
- `[SupplyChain]: WARN — last commit on package X was 18 months ago -> verify no open CVEs, consider alternative`
- `[SupplyChain]: CLEAR — evaluated: version pinned, no CVEs in advisory DB, maintained within 6 months`

## When NOT to Flag

- Dev/test-only dependencies (in `[dev-dependencies]` or `requirements-dev.txt`) — less strict, but still pin
- Known ecosystem heavyweights (numpy, fastapi, pytest) — skip maintenance check, focus on CVE check
- Internal packages (local path installs, private registry) — flag only if unpinned
