#!/usr/bin/env python3
"""Generates redesigned skill_activation and no_filter_expected tasks for tasks.json."""
import json

BASE = (
    "You are a senior ML engineer. Tech stack: Python + FastAPI + pytest + "
    "Docker + Hexagonal Architecture.\n\n"
    "Rules:\n"
    "- TDD: always write tests first, never adapt tests to code\n"
    "- Hexagonal arch: no framework imports in core/\n"
    "- Commits: subject line only, \u226472 chars, NO Co-Authored-By footers\n"
    "- Plan mode required for multi-file changes\n"
    "- Never hardcode secrets"
)
ENV = (
    "\n\n## Session Environment\n"
    "Platform: linux | Shell: bash | Python: python3 | Sessions: 8"
)
EXTRA_BLOCKS = (
    "\n\n## [CONTEXT REFRESH \u2014 Long Session]\n"
    "Long session detected. Core rules reminder:\n"
    "- TDD: write tests before code, never adapt tests to fit existing code\n"
    "- Hexagonal architecture: core/ must have zero framework imports\n"
    "- Commits: subject line only \u226472 chars, NO Co-Authored-By or AI attribution\n"
    "- Plan mode is mandatory for any multi-file change or design decision\n"
    "- Verify with user before any destructive operation\n"
    "- Never expose secrets, tokens or API keys in code or diffs\n"
    "- All configuration via environment variables\n\n"
    "## [PLAN-MODE REQUIRED \u2014 Multi-file Change Detected]\n"
    "This request touches multiple files and requires planning.\n"
    "Call EnterPlanMode IMMEDIATELY \u2014 before reading files, writing code, or taking any action.\n"
    "Steps: (1) Call EnterPlanMode. (2) Explore codebase. "
    "(3) Present plan. (4) Wait for approval. (5) Call ExitPlanMode and implement.\n\n"
    "## Commit Rules Reminder\n"
    "One commit = one logical stage. Subject line only, \u226472 chars. "
    "NEVER add Co-Authored-By or AI attribution. Max 2\u20133 commits per session.\n\n"
    "## Security Review Required\n"
    "Modified security-sensitive code detected (auth, DB, user input). "
    "Run /security-review before committing."
)

SYS_FULL = BASE + ENV + EXTRA_BLOCKS
SYS_COMPACT = BASE + ENV
SIMPLE_SYS = BASE


def sa(id_, name, msgs, user_msg):
    return {
        "id": id_, "category": "skill_activation", "name": name,
        "system_prompt_baseline": SYS_FULL,
        "system_prompt_optimized": SYS_COMPACT,
        "messages_baseline": msgs, "messages_optimized": msgs,
        "user_message": user_msg,
    }


def nf(id_, name, msgs, user_msg):
    return {
        "id": id_, "category": "no_filter_expected", "name": name,
        "system_prompt_baseline": SIMPLE_SYS,
        "system_prompt_optimized": SIMPLE_SYS,
        "messages_baseline": msgs, "messages_optimized": msgs,
        "user_message": user_msg,
    }


skill_tasks = [
    sa("skill-fastapi-001", "FastAPI endpoint returns 422 debug",
       [{"role": "user", "content": "My POST /users endpoint returns 422. Sending: {\"email\": \"test@example.com\", \"password\": \"secret123\"}"},
        {"role": "assistant", "content": "A 422 means Pydantic rejected the request. Is the password field SecretStr? Are there length validators?"},
        {"role": "user", "content": "SecretStr with length >= 8. The error says: [{\"loc\":[\"body\",\"email\"],\"msg\":\"value is not a valid email address\"}]"}],
       "The email is test@example.com. Why does Pydantic reject it as invalid?"),

    sa("skill-langgraph-001", "LangGraph conditional edge routes to wrong node",
       [{"role": "user", "content": "Conditional edge after classify node. When state decision is escalate it should go to human_review but goes to auto_resolve."},
        {"role": "assistant", "content": "Show me the add_conditional_edges call and the routing function."},
        {"role": "user", "content": "graph.add_conditional_edges('classify', lambda state: state['decision'], {'escalate': 'human_review', 'resolve': 'auto_resolve'}). State decision is definitely 'escalate'."}],
       "The routing function returns 'escalate' but the graph goes to auto_resolve. What is the bug?"),

    sa("skill-pytest-001", "pytest module-scoped fixture causes test pollution",
       [{"role": "user", "content": "db_session fixture is scope=module. Tests in class A modify rows, class B sees the modified data."},
        {"role": "assistant", "content": "Module scope shares the fixture across all tests in the module. For class isolation use scope=class with rollback in teardown."},
        {"role": "user", "content": "scope=function is too slow. 200 tests went from 20s to 90s. We need module scope with isolation between classes."}],
       "How do I keep module-scoped sessions while ensuring test isolation between test classes?"),

    sa("skill-docker-001", "Docker Compose service cannot reach postgres by hostname",
       [{"role": "user", "content": "FastAPI service tries to connect to host postgres and gets connection refused. Both are in docker-compose.yml."},
        {"role": "assistant", "content": "Services must share a network and postgres must be healthy before api starts. What does your depends_on look like?"},
        {"role": "user", "content": "depends_on: [postgres]. Connection string: postgresql://user:pass@postgres:5432/mydb. The api starts before postgres is ready."}],
       "How do I make the api service wait for postgres to be ready before starting?"),

    sa("skill-mlflow-001", "MLflow experiment runs not appearing in UI",
       [{"role": "user", "content": "Logging with mlflow.log_metric but runs do not appear at localhost:5000."},
        {"role": "assistant", "content": "Set tracking URI before logging: mlflow.set_tracking_uri('http://localhost:5000'). Verify the server is running."},
        {"role": "user", "content": "Added set_tracking_uri. Now: ConnectionError: HTTPConnectionPool host=localhost port=5000 Max retries exceeded."}],
       "The MLflow server is running but the client cannot connect. What should I check?"),

    sa("skill-pydantic-001", "Pydantic v2 model_validator fails on PATCH with partial data",
       [{"role": "user", "content": "model_validator mode=after sees None for missing fields on PATCH. I need to validate field combinations."},
        {"role": "assistant", "content": "Use model_fields_set to check which fields were explicitly provided. For cross-field validation on partials you need the DB state."},
        {"role": "user", "content": "model_fields_set shows the PATCH fields. But validator needs: if field_a is set, field_b must also exist either in request or in DB."}],
       "How do I validate field combinations in Pydantic v2 for PATCH where missing fields live in the database?"),

    sa("skill-mypy-001", "mypy incompatible type list[Event | None] vs list[Event]",
       [{"role": "user", "content": "mypy error: Argument 1 to process_events has incompatible type list[Event | None]; expected list[Event]"},
        {"role": "assistant", "content": "Filter Nones before passing: [e for e in events if e is not None]. Or change the signature to accept Optional items."},
        {"role": "user", "content": "Events come from DB. Mapping Row to Event can return None if row is malformed. So the list is genuinely List[Event | None] at that stage."}],
       "What is the cleanest pattern to handle List[T | None] to List[T] with mypy strict mode?"),

    sa("skill-alembic-001", "Alembic migration fails adding NOT NULL column to existing data",
       [{"role": "user", "content": "Adding NOT NULL column tenant_id to table with 50k rows. Migration fails: column contains null values."},
        {"role": "assistant", "content": "Split into: (1) add nullable with server default, (2) backfill, (3) add NOT NULL constraint as separate migrations."},
        {"role": "user", "content": "Split exactly that way. First migration adds nullable. Second backfills. Third sets NOT NULL. Third still fails on staging."}],
       "Backfill ran but NOT NULL constraint still fails on staging. What could cause this?"),

    sa("skill-qdrant-001", "Qdrant search returns irrelevant results despite high similarity",
       [{"role": "user", "content": "Semantic search over 100k docs returns cosine similarity over 0.85 but clearly wrong results. Query: FastAPI dependency injection patterns."},
        {"role": "assistant", "content": "High score with wrong results usually means embedding model mismatch. How were docs indexed vs how are queries embedded?"},
        {"role": "user", "content": "Docs used text-embedding-ada-002. Queries use text-embedding-3-small. Different OpenAI generations with incompatible embedding spaces."}],
       "How do I migrate 100k document embeddings from ada-002 to text-embedding-3-small without search downtime?"),

    sa("skill-infra-001", "Terraform YC Serverless Container 403 PermissionDenied",
       [{"role": "user", "content": "terraform apply fails: rpc error code=PermissionDenied. Service account exists."},
        {"role": "assistant", "content": "The Terraform SA needs serverless.containers.admin. The runtime execution SA needs iam.serviceAccounts.user on itself."},
        {"role": "user", "content": "Terraform SA has serverless.containers.admin. Execution SA has container-registry.images.puller. Still 403."}],
       "Which exact IAM roles does the execution service account need to run a YC Serverless Container?"),
]

nf_tasks = [
    nf("nofilter-git-status-001", "git status short output no filter applies",
       [{"role": "user", "content": "Check the current git status before we commit."},
        {"role": "assistant", "content": "Running git status to see staged and unstaged files."}],
       "The output shows 3 modified files and 1 untracked. Which should we stage?"),

    nf("nofilter-ls-001", "ls directory listing no filter applies",
       [{"role": "user", "content": "List the contents of the src/ directory."},
        {"role": "assistant", "content": "Listing src/ to see the project structure."}],
       "What is the purpose of each subdirectory shown?"),

    nf("nofilter-cat-001", "cat pyproject.toml file read no filter applies",
       [{"role": "user", "content": "Show me pyproject.toml to check project dependencies."},
        {"role": "assistant", "content": "Reading pyproject.toml."}],
       "Which dependencies are under dev? Are any outdated?"),

    nf("nofilter-echo-001", "echo trivial output no filter applies",
       [{"role": "user", "content": "Print the current working directory path."},
        {"role": "assistant", "content": "Echoing the current path."}],
       "Is this the correct project root we should be working from?"),

    nf("nofilter-python-version-001", "python version check short output no filter applies",
       [{"role": "user", "content": "Verify which Python version is active in this environment."},
        {"role": "assistant", "content": "Checking the Python version."}],
       "Is Python 3.11+ available? The project requires it for match statements."),
]


def main():
    import pathlib
    tasks_path = pathlib.Path(__file__).parent / "tasks.json"
    with open(tasks_path, encoding="utf-8") as f:
        existing = json.load(f)

    bash_filter_tasks = [t for t in existing if t["category"] == "bash_filter"]
    all_tasks = bash_filter_tasks + skill_tasks + nf_tasks

    required_keys = [
        "id", "category", "system_prompt_baseline", "system_prompt_optimized",
        "messages_baseline", "messages_optimized", "user_message",
    ]
    for t in all_tasks:
        for k in required_keys:
            assert k in t, f"{t['id']} missing {k}"

    for t in skill_tasks:
        assert t["system_prompt_baseline"] != t["system_prompt_optimized"], f"{t['id']}: prompts should differ"
        assert t["messages_baseline"] == t["messages_optimized"], f"{t['id']}: messages should be identical"

    for t in nf_tasks:
        assert t["system_prompt_baseline"] == t["system_prompt_optimized"], f"{t['id']}: should be identical"

    with open(tasks_path, "w", encoding="utf-8") as f:
        json.dump(all_tasks, f, ensure_ascii=False, indent=2)

    print(
        f"OK: {len(bash_filter_tasks)} bash_filter + "
        f"{len(skill_tasks)} skill_activation + "
        f"{len(nf_tasks)} no_filter_expected = "
        f"{len(all_tasks)} total"
    )

    delta_chars = len(SYS_FULL) - len(SYS_COMPACT)
    print(f"System prompt savings per call: {delta_chars} chars (~{delta_chars // 4} tokens)")


if __name__ == "__main__":
    main()
