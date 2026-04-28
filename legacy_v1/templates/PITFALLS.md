# Known Pitfalls

Contextually injected by skill-activation-prompt.js when changed files or prompt
match a section header. Only relevant sections are loaded — not the full file.

## Docker

- Always use `docker compose` (v2), not `docker-compose` (v1)
- Never bind-mount `node_modules` or `.venv` into container
- Use multi-stage builds: builder stage for deps, slim runtime stage
- `COPY requirements.txt` before `COPY .` for layer caching

## Terraform

- `prevent_destroy` lifecycle on all production resources
- Never run `terraform destroy` without explicit confirmation
- Use `terraform plan -out=plan.tfplan` before apply
- State files contain secrets — never commit to git

## Authentication

- JWT tokens: always validate expiry server-side, not just client
- Never store tokens in localStorage on production — use httpOnly cookies
- Rotate secrets on every deployment, not just on breach
- Rate-limit login endpoints (5 attempts / minute)

## Database

- Always use Alembic migrations, never raw ALTER TABLE
- Test migrations with `--sql` flag before applying
- Add indexes for foreign keys and frequently filtered columns
- Use `SELECT ... FOR UPDATE` for concurrent writes

## Deployment

- Health check endpoints must be unauthenticated
- Verify `/health` returns 200 before routing traffic
- Blue-green or canary — never in-place on production
- Log deployment SHA for traceability
