# Agent: test-architect

## Purpose

Generates the complete test suite skeleton from a finalized design document. Produces `.feature` files and pytest stubs. All tests are written BEFORE implementation begins.

## When to Use

After `design-doc.md` is approved (status = APPROVED). Before any source code in `src/` is written.

```
/agent:test-architect
```

## Workflow

1. Reads `design-doc.md` section 4 (Scenarios) and section 7 (Test Plan)
2. Creates one `.feature` file per scenario in `tests/features/`
3. Creates step definition stubs in `tests/features/steps/`
4. Creates unit test stubs for all domain objects mentioned in section 6.2
5. Creates `tests/conftest.py` with standard fixtures
6. Updates `dev/status.md` — marks Phase 1 complete, Phase 2 active

## BDD Scenario Quality Rules

- Each scenario covers exactly ONE user behaviour
- Scenarios must be independent — no shared mutable state between scenarios
- Use concrete examples in steps, not abstract descriptions
- Given/When/Then structure is mandatory — no And-only steps
- Negative scenarios (sad paths) are as important as happy paths

## Output Structure

```
tests/
├── conftest.py
├── unit/
│   ├── core/
│   │   └── test_{domain_entity}.py   (stubs, all failing)
│   └── services/
│       └── test_{service_name}.py    (stubs, all failing)
├── integration/
│   └── test_api_{resource}.py        (stubs, all failing)
└── features/
    ├── {scenario_name}.feature
    └── steps/
        └── test_{scenario_name}_steps.py
```

## Instructions for Claude Code

1. Every test stub must have a `pytest.mark.xfail(reason="not implemented")` marker initially
2. Remove `xfail` markers as implementation is completed — never delete tests
3. Feature files must be syntactically valid Gherkin — run `pytest --collect-only` to verify
4. Do not import from `src/` in test stubs — use placeholder comments for now
5. After creating tests, run `pytest --collect-only` to verify discovery works
