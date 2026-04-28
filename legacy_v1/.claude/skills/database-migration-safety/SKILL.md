# Skill: Database Migration Safety

## When to Load

Auto-load when: working with Alembic, raw SQL migrations, schema changes, `migrations/` directory, or `*.sql` files. Triggers on `alembic`, `migration`, `upgrade`, `downgrade`, `schema`, `ALTER TABLE` (≥2 keywords).

## Core Rules

Every migration must satisfy these requirements before `alembic upgrade head` runs:

1. **Reversible** — `downgrade()` must be implemented and tested. `pass` is not acceptable.
2. **Staged** — run against a staging/dev database before production.
3. **Piloted** — for data migrations over 1M rows, run on a 1% sample first.
4. **Snapshotted** — take a DB snapshot/backup before any destructive operation (DROP, ALTER with data loss risk).

## Pre-Migration Checklist

Before proposing or executing any migration:

```
[ ] downgrade() is implemented (not pass)
[ ] Migration tested on staging DB
[ ] For tables > 100k rows: migration is non-locking (CONCURRENT index, batched updates)
[ ] No data loss without explicit acknowledgment: DROP COLUMN, TRUNCATE, type narrowing
[ ] --autogenerate output reviewed manually (it misses: renames, indexes, check constraints)
[ ] Rollback plan documented: "If this fails in prod, run: alembic downgrade -1"
```

## Anti-Patterns — Block on Detection

| Anti-Pattern | Risk | Required Action |
|---|---|---|
| `downgrade()` is `pass` | Irreversible migration | Implement downgrade or get explicit sign-off |
| `DROP COLUMN` without nullable grace period | Data loss on rollback | Add `nullable=True` first, drop in next release |
| `--autogenerate` applied without review | Silent schema drift | Always diff before apply |
| `alembic upgrade head` in prod without staging | Broken prod schema | Require staging run first |
| Locking `ALTER TABLE` on large table | Table lock, downtime | Use `CREATE INDEX CONCURRENTLY`, batched UPDATE |
| Migration touches multiple unrelated models | Hard to rollback atomically | Split into separate migrations |

## Alembic-Specific Guidance

`--autogenerate` misses the following — always check manually:
- Table/column renames (it generates DROP + ADD instead)
- `server_default` changes
- Check constraints (`CheckConstraint`)
- Partial indexes
- Custom types

Safe pattern for removing a column:
- Migration N: `nullable=True`, remove from ORM model
- Deploy N, verify no writes
- Migration N+1: `DROP COLUMN`

## Quick Mode Format

When this skill is active, append to analysis:

```
[MigSafety]: BLOCK|WARN|CLEAR — [specific risk identified] -> [required action]
```

Examples:
- `[MigSafety]: BLOCK — downgrade() is pass on 2M-row table -> implement downgrade or get explicit sign-off`
- `[MigSafety]: WARN — no staging run documented -> confirm staging test before prod apply`
- `[MigSafety]: CLEAR — evaluated: downgrade implemented, staging confirmed, no locking ops`

## When NOT to Flag

- Simple `ADD COLUMN NOT NULL DEFAULT` on small tables (< 10k rows) — low risk
- Adding new tables only — no existing data affected
- Index creation with `CONCURRENTLY` — already non-locking
