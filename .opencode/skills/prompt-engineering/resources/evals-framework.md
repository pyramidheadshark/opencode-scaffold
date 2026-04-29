# Evals Framework

## Minimal Eval Runner

```python
from dataclasses import dataclass, field
from typing import Callable
import statistics

@dataclass
class EvalCase:
    name: str
    input: str
    expected: str
    scorer: Callable[[str, str], float] = field(
        default_factory=lambda: lambda actual, expected: 1.0 if actual.strip() == expected.strip() else 0.0
    )

@dataclass
class EvalResult:
    name: str
    score: float
    actual: str
    expected: str

def run_eval_suite(
    cases: list[EvalCase],
    model_fn: Callable[[str], str],
) -> dict:
    results = [
        EvalResult(
            name=c.name,
            score=c.scorer(model_fn(c.input), c.expected),
            actual=model_fn(c.input),
            expected=c.expected,
        )
        for c in cases
    ]
    scores = [r.score for r in results]
    return {
        "mean": statistics.mean(scores),
        "min": min(scores),
        "passed": sum(1 for s in scores if s >= 0.8),
        "total": len(scores),
        "results": results,
    }
```

## Scorer Types

```python
def exact_match(actual: str, expected: str) -> float:
    return 1.0 if actual.strip().lower() == expected.strip().lower() else 0.0

def contains_all(actual: str, expected: str) -> float:
    keywords = expected.split(",")
    hits = sum(1 for kw in keywords if kw.strip().lower() in actual.lower())
    return hits / len(keywords)

def json_field_match(field: str) -> Callable[[str, str], float]:
    import json
    def scorer(actual: str, expected: str) -> float:
        try:
            actual_val = json.loads(actual).get(field)
            expected_val = json.loads(expected).get(field)
            return 1.0 if actual_val == expected_val else 0.0
        except (json.JSONDecodeError, AttributeError):
            return 0.0
    return scorer
```

## CI Integration

```python
if __name__ == "__main__":
    import sys
    results = run_eval_suite(EVAL_CASES, lambda prompt: call_claude(prompt))
    print(f"Score: {results['mean']:.2%} ({results['passed']}/{results['total']} passed)")
    if results["mean"] < 0.85:
        print("FAIL: score below threshold 0.85")
        sys.exit(1)
```

## Regression Guard

Before merging any prompt change, run evals against the old and new prompt:

```bash
python scripts/evals.py --prompt-version v1 > baseline.json
python scripts/evals.py --prompt-version v2 > candidate.json
python scripts/compare_evals.py baseline.json candidate.json --threshold 0.0
```

Fail if candidate score < baseline score. Never deploy a regression.
