# GitHub Actions Patterns

## When to Load This Skill

Load when working with: `.github/workflows/*.yml`, CI pipelines, lint/test/build/deploy jobs, matrix strategies, GitHub secrets, environment protection rules.

Keywords: `github actions`, `ci`, `workflow`, `lint job`, `test job`, `deploy`, `matrix`, `pipeline`

## Canonical Job Templates

### Lint (ruff + mypy)

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: astral-sh/setup-uv@v4
      with:
        version: "latest"
    - run: uv sync --frozen
    - run: uv run ruff check .
    - run: uv run mypy src/
```

### Test (pytest + coverage)

```yaml
test:
  runs-on: ubuntu-latest
  needs: lint
  steps:
    - uses: actions/checkout@v4
    - uses: astral-sh/setup-uv@v4
      with:
        version: "latest"
    - run: uv sync --frozen
    - run: uv run pytest --cov=src --cov-report=xml --cov-fail-under=80
    - uses: codecov/codecov-action@v4
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
```

### Docker Build & Push

```yaml
docker-build:
  runs-on: ubuntu-latest
  needs: test
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - uses: docker/login-action@v3
      with:
        registry: cr.yandex
        username: json_key
        password: ${{ secrets.YC_SA_JSON_CREDENTIALS }}
    - uses: docker/build-push-action@v5
      with:
        context: .
        push: ${{ github.ref == 'refs/heads/main' }}
        tags: cr.yandex/${{ secrets.YC_REGISTRY_ID }}/app:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

### Deploy to Yandex Cloud

```yaml
deploy:
  runs-on: ubuntu-latest
  needs: docker-build
  environment: production
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: yc-actions/yc-cr-login@v2
      with:
        yc-sa-json-credentials: ${{ secrets.YC_SA_JSON_CREDENTIALS }}
    - name: Deploy to YC Serverless Container
      run: |
        yc serverless container revision deploy \
          --container-name ${{ vars.CONTAINER_NAME }} \
          --image cr.yandex/${{ secrets.YC_REGISTRY_ID }}/app:${{ github.sha }} \
          --service-account-id ${{ secrets.YC_SA_ID }}
```

## Full Workflow Structure

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    ...
  test:
    needs: lint
    ...
  docker-build:
    needs: test
    ...
  deploy:
    needs: docker-build
    environment: production
    if: github.ref == 'refs/heads/main'
    ...
```

## Key Patterns

### uv caching

```yaml
- uses: astral-sh/setup-uv@v4
  with:
    version: "latest"
    enable-cache: true
    cache-dependency-glob: "uv.lock"
```

### Matrix strategy (multi-Python)

```yaml
strategy:
  matrix:
    python-version: ["3.11", "3.12"]
steps:
  - uses: astral-sh/setup-uv@v4
    with:
      python-version: ${{ matrix.python-version }}
```

### Environment protection

Use `environment: production` on deploy jobs — requires manual approval in GitHub UI (Settings → Environments).

### Secrets vs Variables

- `secrets.*` — sensitive values (tokens, keys, passwords) — encrypted
- `vars.*` — non-sensitive config (container names, region) — plain text
