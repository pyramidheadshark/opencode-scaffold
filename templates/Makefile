.PHONY: install dev lint test test-cov format clean \
        docker-up docker-down docker-logs docker-build \
        infra-plan infra-apply infra-destroy

PROJECT_NAME := $(shell grep '^name' pyproject.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')

install:
	uv sync

dev:
	uv sync --dev

lint:
	uv run ruff check .
	uv run mypy src/

format:
	uv run ruff format .
	uv run ruff check . --fix

test:
	uv run pytest -x

test-cov:
	uv run pytest --cov=src --cov-report=html
	@echo "Coverage report: htmlcov/index.html"

test-unit:
	uv run pytest tests/unit/ -v

test-bdd:
	uv run pytest tests/features/ -v

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf htmlcov .coverage

run:
	uv run uvicorn src.$(subst -,_,$(PROJECT_NAME)).main:app --reload --host 0.0.0.0 --port 8000

docker-build:
	docker build -t $(PROJECT_NAME):latest .

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f app

docker-restart:
	docker compose restart app

infra-plan:
	cd infra/terraform && terraform plan -var-file=$(ENV).tfvars

infra-apply:
	cd infra/terraform && terraform apply -var-file=$(ENV).tfvars

infra-destroy:
	cd infra/terraform && terraform destroy -var-file=$(ENV).tfvars

ssh:
	ssh ubuntu@$(shell cd infra/terraform && terraform output -raw vm_ip)
