# Python Project Standards

## When to Load This Skill

Load when working with: `pyproject.toml`, Python files, pre-commit config, dependency management, type hints, linting configuration.

## Stack Versions (as of 2026-Q1)

- Python: `>=3.11` (minimum), prefer `3.12`
- uv: latest stable (replaces pip, venv, pip-tools — all in one)
- Ruff: `>=0.9.0`
- MyPy: `>=1.10.0`
- pre-commit: `>=3.7.0`

## pyproject.toml Standard Config

The canonical `pyproject.toml` for all projects. Copy and adjust `[project].name` and `dependencies`.

```toml
[project]
name = "project-name"
version = "0.1.0"
description = ""
readme = "README.md"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = [
    "ruff>=0.9.0",
    "mypy>=1.10.0",
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-bdd>=7.0.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.27.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py311"
line-length = 100
fix = true

[tool.ruff.lint]
select = [
    "E",   "W",   # pycodestyle
    "F",          # pyflakes
    "I",          # isort
    "B",          # bugbear
    "C4",         # comprehensions
    "UP",         # pyupgrade
    "ANN",        # annotations
    "S",          # bandit security
    "SIM",        # simplify
    "TCH",        # type-checking imports
    "RUF",        # ruff-specific
]
ignore = ["ANN101", "ANN102", "S101"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "ANN"]

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
no_implicit_reexport = true
ignore_missing_imports = false

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=80"

[tool.coverage.run]
source = ["src"]
omit = ["tests/*", "*/migrations/*"]
```

## uv Commands Reference

```bash
uv init project-name
uv add fastapi uvicorn[standard]
uv add --dev ruff mypy pytest pytest-asyncio pytest-bdd
uv run pytest
uv run ruff check .
uv run mypy src/
uv sync
uv lock
```

## pre-commit Config Standard

See `resources/pre-commit-config.md` for the full `.pre-commit-config.yaml`.

## Project File Structure

```
project-name/
├── src/
│   └── {project_name}/
│       ├── __init__.py
│       ├── api/
│       │   ├── __init__.py
│       │   └── routers/
│       ├── core/
│       │   └── __init__.py
│       ├── services/
│       │   └── __init__.py
│       ├── adapters/
│       │   └── __init__.py
│       └── models/
│           └── __init__.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── features/       # BDD .feature files
├── dev/
│   ├── status.md       # ALWAYS maintained
│   └── active/         # task-specific context
├── pyproject.toml
├── uv.lock
├── .pre-commit-config.yaml
├── .gitignore
├── .env.example
├── design-doc.md
└── README.md
```

## .env.example Standard

Every project must have `.env.example` committed to repo with all required keys listed but no values.
`.env` is always in `.gitignore`. Application validates all required env vars at startup via Pydantic `BaseSettings`.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    openrouter_api_key: str
    database_url: str
    environment: str = "development"


settings = Settings()
```

## .gitignore Standard

See `resources/gitignore.md` for the full `.gitignore` template covering Python, uv, ML artifacts, IDE files.
