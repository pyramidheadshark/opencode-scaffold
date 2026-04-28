# Eval Design — Claude API

## Principle

Write evals before deploying prompt changes. An eval is a set of (input, expected_output) pairs with a scoring function. Never judge prompt quality by "feels better."

## Minimal Eval Structure

```python
from dataclasses import dataclass
from typing import Callable

@dataclass
class EvalCase:
    name: str
    input: str
    expected: str
    scorer: Callable[[str, str], float]

def exact_match(actual: str, expected: str) -> float:
    return 1.0 if actual.strip() == expected.strip() else 0.0

def contains_match(actual: str, expected: str) -> float:
    return 1.0 if expected.lower() in actual.lower() else 0.0
```

## Running Evals

```python
def run_evals(cases: list[EvalCase], prompt_fn: Callable[[str], str]) -> dict:
    results = []
    for case in cases:
        actual = prompt_fn(case.input)
        score = case.scorer(actual, case.expected)
        results.append({"name": case.name, "score": score, "actual": actual})

    mean_score = sum(r["score"] for r in results) / len(results)
    return {"mean_score": mean_score, "results": results}
```

## CI Integration

Add an eval job to GitHub Actions that runs on every PR touching prompt files:

```yaml
- name: Run prompt evals
  run: python scripts/run_evals.py --threshold 0.85
```

Fail CI if mean_score < threshold. This prevents silent prompt regressions.

## Prompt Versioning

Store prompts in `prompts/` directory with semantic versions:

```
prompts/
├── v1.0/
│   └── system_prompt.md
└── v1.1/
    └── system_prompt.md
```

Run evals comparing v1.0 vs v1.1 before merging. Never deploy a prompt that scores lower than the baseline.
