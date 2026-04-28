# Test-First Patterns

## When to Load This Skill

Load when writing tests, creating `.feature` files, setting up conftest, discussing test strategy, or reviewing coverage.

## Philosophy

Tests are written BEFORE code. Always. No exceptions.

The order is: Design Doc → BDD Scenarios → Unit Tests → Implementation.

BDD scenarios come from the design document's use cases section — they are a direct translation of business requirements into executable specifications. This makes tests the living documentation of business logic.

## Two-Layer Testing Strategy

### Layer 1: BDD (Behaviour-Driven Development)

BDD scenarios live in `tests/features/*.feature` and describe behaviour from the user's perspective. They directly correspond to use cases in `design-doc.md`.

Use `pytest-bdd` (not Behave — stays within pytest ecosystem).

```gherkin
Feature: User asks a question to the knowledge base assistant

  Scenario: Successful answer from knowledge base
    Given the knowledge base contains documents about system usage
    When the user asks "How do I add a new user?"
    Then the assistant returns an answer with steps
    And the answer references the relevant document section

  Scenario: Question outside knowledge base scope
    Given the knowledge base contains documents about system usage
    When the user asks "What is the weather in Moscow?"
    Then the assistant responds that it cannot answer this question
    And no hallucinated information is returned
```

### Layer 2: Unit Tests (TDD Red-Green-Refactor)

Unit tests cover individual functions and classes in `core/` and `services/`. They use pytest directly.

```python
import pytest

from src.project_name.core.domain import KnowledgeQuery, QueryResult


def test_query_result_is_empty_when_no_documents_match():
    query = KnowledgeQuery(text="unrelated question", top_k=3)
    result = QueryResult(matches=[], query=query)
    assert result.is_empty is True


def test_query_result_is_not_empty_when_matches_exist():
    query = KnowledgeQuery(text="how to add user", top_k=3)
    result = QueryResult(matches=["doc1", "doc2"], query=query)
    assert result.is_empty is False
```

## conftest.py Standard Structure

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient

from src.project_name.main import create_app


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest_asyncio.fixture
async def client(app):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_settings(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
```

## pytest-bdd Step Definitions Pattern

```python
from pytest_bdd import given, scenarios, then, when

scenarios("../features/knowledge_base.feature")


@given("the knowledge base contains documents about system usage")
def knowledge_base_with_docs(kb_service):
    kb_service.load_fixture_documents()


@when('the user asks "How do I add a new user?"')
def user_asks_question(client, context):
    context["response"] = client.post("/api/v1/chat", json={"message": "How do I add a new user?"})


@then("the assistant returns an answer with steps")
def response_contains_steps(context):
    assert context["response"].status_code == 200
    assert "steps" in context["response"].json()["answer"].lower()
```

## Coverage Requirements

- Minimum 80% overall (enforced in `pyproject.toml`)
- 100% coverage for `core/` — domain logic must be fully tested
- `adapters/` can be lower — use integration tests with real services when possible

## Running Tests

```bash
uv run pytest                              # all tests with coverage
uv run pytest tests/unit/ -v              # unit only
uv run pytest tests/features/ -v         # BDD only
uv run pytest -k "test_query" -v         # filter by name
uv run pytest --cov-report=html          # HTML coverage report
```

## Test File Naming Convention

```
tests/
├── unit/
│   ├── core/
│   │   └── test_domain.py
│   └── services/
│       └── test_item_service.py
├── integration/
│   └── test_api_endpoints.py
└── features/
    ├── knowledge_base.feature
    └── steps/
        └── test_knowledge_base_steps.py
```
