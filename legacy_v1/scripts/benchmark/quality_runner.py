#!/usr/bin/env python3
"""
Quality benchmark runner — scores models on objectively-evaluated tasks.

Tasks:
  bug-hunt-01   (E1): Find 3 intentional bugs in fibonacci_broken.py
  security-01   (E3): Find 3 security vulnerabilities in vulnerable_api.py
  gen-01        (E5): Generate a YAML parser that passes 5 pytest test cases

Usage:
  python scripts/benchmark/quality_runner.py --task bug-hunt-01 --model haiku
  python scripts/benchmark/quality_runner.py --task security-01 --model sonnet --runs 3
  python scripts/benchmark/quality_runner.py --task gen-01 --model gemini-flash

Output: scripts/benchmark/output/quality-{task}-{model}-{ts}.jsonl
Each entry: { model, task, prompt_tokens, completion_tokens, cost_usd, score, items }

OpenRouter dashboard: https://openrouter.ai/activity
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

LAB_DIR = Path(__file__).parent / "lab"
OUTPUT_DIR = Path(__file__).parent / "output"

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
HTTP_REFERER = "https://github.com/pyramidheadshark/claude-scaffold"
APP_TITLE = "claude-scaffold quality-benchmark"

MODELS = {
    "haiku":        "anthropic/claude-haiku-4.5",
    "sonnet":       "anthropic/claude-sonnet-4.6",
    "gemini-flash": "google/gemini-3-flash-preview",
}

PRICES = {
    "anthropic/claude-haiku-4.5":       {"input": 0.80e-6,  "output": 4.00e-6},
    "anthropic/claude-sonnet-4.6":      {"input": 3.00e-6,  "output": 15.00e-6},
    "google/gemini-3-flash-preview":    {"input": 0.10e-6,  "output": 0.40e-6},
}


# ---------------------------------------------------------------------------
# Task definitions
# ---------------------------------------------------------------------------

def _read_lab(filename: str) -> str:
    path = LAB_DIR / filename
    return path.read_text(encoding="utf-8")


def get_task_prompt(task: str) -> str:
    if task == "bug-hunt-01":
        code = _read_lab("fibonacci_broken.py")
        return (
            "Find ALL bugs in the following Python function. "
            "For each bug, describe: (1) what the bug is, (2) which line it's on, "
            "(3) what the correct code should be.\n\n"
            f"```python\n{code}\n```"
        )
    if task == "security-01":
        code = _read_lab("vulnerable_api.py")
        return (
            "Identify ALL security vulnerabilities in the following Python code. "
            "For each vulnerability, describe: (1) the vulnerability class, "
            "(2) which line it's on, (3) how to fix it.\n\n"
            f"```python\n{code}\n```"
        )
    if task == "gen-01":
        spec = _read_lab("yaml_parser_spec.md")
        return (
            "Implement the Python function described in the specification below. "
            "Return ONLY a Python code block with the implementation. "
            "Do not include test cases in your response — only the function.\n\n"
            f"{spec}"
        )
    raise ValueError(f"Unknown task: {task}")


# ---------------------------------------------------------------------------
# Scorers
# ---------------------------------------------------------------------------

# E1: bug-hunt-01
BUG_HUNT_ITEMS = [
    {
        "id": "bug1",
        "description": "Wrong base case: n<=0 returns -1 instead of handling n=0→0 and n<0→error",
        "keywords": ["n <= 0", "n<0", "base case", "returns -1", "fib(0)", "n == 0", "zero"],
    },
    {
        "id": "bug2",
        "description": "Wrong range: range(n-2) should be range(n-1)",
        "keywords": ["range(n - 2)", "range(n-2)", "n - 2", "n-2", "one short", "iteration", "off by one", "off-by-one"],
    },
    {
        "id": "bug3",
        "description": "Wrong return variable: return a should be return b",
        "keywords": ["return a", "return b", "wrong variable", "fib(n-1)", "a instead"],
    },
]

# E3: security-01
SECURITY_ITEMS = [
    {
        "id": "sqli",
        "description": "SQL injection via f-string interpolation in get_user()",
        "keywords": ["sql injection", "sqli", "sql", "injection", "unsanitized", "parameterized", "f-string", "format string"],
    },
    {
        "id": "hardcoded_secret",
        "description": "Hardcoded secret key in source code",
        "keywords": ["hardcoded", "hard-coded", "hard coded", "secret key", "credentials", "mysecret", "plaintext", "source code", "environment variable"],
    },
    {
        "id": "eval_rce",
        "description": "Arbitrary code execution via eval() on user input",
        "keywords": ["eval", "code execution", "arbitrary", "rce", "remote code", "execute", "dangerous"],
    },
]


def score_keyword_match(response_text: str, items: list[dict]) -> tuple[float, list[dict]]:
    text_lower = response_text.lower()
    found_items = []
    for item in items:
        found = any(kw.lower() in text_lower for kw in item["keywords"])
        found_items.append({"id": item["id"], "found": found, "description": item["description"]})
    score = sum(1 for i in found_items if i["found"]) / len(found_items)
    return score, found_items


# E5: gen-01 — test cases run via exec() (no subprocess, cross-platform safe)
GEN01_TESTS = [
    (
        "test_case_1",
        "basic key-value pairs",
        lambda p: p("name: Alice\nage: 30\ncity: Moscow") == {"name": "Alice", "age": "30", "city": "Moscow"},
    ),
    (
        "test_case_2",
        "comments and blank lines ignored",
        lambda p: p("# header comment\n\nproject: my-app\n\n# another comment\nversion: 1.0\n")
                  == {"project": "my-app", "version": "1.0"},
    ),
    (
        "test_case_3",
        "whitespace stripped",
        lambda p: p("  key1  :   value1  \n  key2:value2  ") == {"key1": "value1", "key2": "value2"},
    ),
    (
        "test_case_4",
        "empty input returns empty dict",
        lambda p: p("") == {} and p("# only comments\n# nothing here") == {},
    ),
    (
        "test_case_5",
        "duplicate keys — last value wins",
        lambda p: p("color: red\nsize: large\ncolor: blue") == {"color": "blue", "size": "large"},
    ),
]


def extract_python_code(response_text: str) -> str:
    match = re.search(r"```python\s*([\s\S]*?)```", response_text)
    if match:
        return match.group(1).strip()
    match = re.search(r"```\s*([\s\S]*?)```", response_text)
    if match:
        return match.group(1).strip()
    return response_text.strip()


def score_gen01(response_text: str) -> tuple[float, list[dict]]:
    code = extract_python_code(response_text)
    namespace: dict = {}
    try:
        exec(compile(code, "<generated>", "exec"), namespace)
    except Exception as e:
        return 0.0, [
            {"id": t[0], "found": False, "description": f"compile error: {e}"}
            for t in GEN01_TESTS
        ]

    parse_yaml_fn = namespace.get("parse_yaml")
    if not callable(parse_yaml_fn):
        return 0.0, [
            {"id": t[0], "found": False, "description": "no parse_yaml function defined"}
            for t in GEN01_TESTS
        ]

    items = []
    for test_id, description, run_test in GEN01_TESTS:
        try:
            found = bool(run_test(parse_yaml_fn))
        except Exception:
            found = False
        items.append({"id": test_id, "found": found, "description": description})

    score = sum(1 for i in items if i["found"]) / len(items)
    return score, items


def score_response(task: str, response_text: str) -> tuple[float, list[dict]]:
    if task == "bug-hunt-01":
        return score_keyword_match(response_text, BUG_HUNT_ITEMS)
    if task == "security-01":
        return score_keyword_match(response_text, SECURITY_ITEMS)
    if task == "gen-01":
        return score_gen01(response_text)
    raise ValueError(f"Unknown task: {task}")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def calc_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    prices = PRICES.get(model, {"input": 3.00e-6, "output": 15.00e-6})
    return input_tokens * prices["input"] + output_tokens * prices["output"]


def run_once(client, task: str, model_id: str, session_id: str, run_idx: int) -> dict:
    prompt = get_task_prompt(task)

    response = client.chat.completions.create(
        model=model_id,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        extra_headers={"x-session-id": f"{session_id}-{run_idx}"},
    )

    usage = response.usage
    input_tokens = usage.prompt_tokens
    output_tokens = usage.completion_tokens
    response_text = response.choices[0].message.content or ""

    score, items = score_response(task, response_text)
    cost = calc_cost(input_tokens, output_tokens, model_id)

    return {
        "task": task,
        "model": model_id,
        "run": run_idx,
        "prompt_tokens": input_tokens,
        "completion_tokens": output_tokens,
        "cost_usd": round(cost, 6),
        "score": round(score, 3),
        "items": items,
        "generation_id": response.id,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def print_summary(results: list[dict], task: str, model_id: str):
    avg_score = sum(r["score"] for r in results) / len(results)
    avg_cost = sum(r["cost_usd"] for r in results) / len(results)
    total_cost = sum(r["cost_usd"] for r in results)

    print(f"\n{'='*60}")
    print(f"  Task: {task}  |  Model: {model_id}  |  Runs: {len(results)}")
    print(f"{'='*60}")
    print(f"  {'Run':>4}  {'Score':>7}  {'Cost':>10}  Items")
    print(f"  {'-'*4}  {'------':>7}  {'--------':>10}  -----")
    for r in results:
        found = [i["id"] for i in r["items"] if i["found"]]
        print(f"  {r['run']:>4}  {r['score']:>6.1%}  ${r['cost_usd']:>8.5f}  {', '.join(found) or '—'}")
    print(f"  {'-'*4}  {'------':>7}  {'--------':>10}")
    print(f"  {'AVG':>4}  {avg_score:>6.1%}  ${avg_cost:>8.5f}")
    print(f"  {'TOT':>4}  {'':>7}  ${total_cost:>8.5f}")
    print()


def main():
    if sys.stdout.encoding and sys.stdout.encoding.lower() in ("cp1251", "cp1252", "ascii"):
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Quality benchmark runner (OpenRouter)")
    parser.add_argument("--task", required=True, choices=["bug-hunt-01", "security-01", "gen-01"])
    parser.add_argument("--model", default="haiku", choices=list(MODELS.keys()))
    parser.add_argument("--runs", default=1, type=int, help="Number of runs (default: 1)")
    parser.add_argument("--output", default=None, type=Path)
    parser.add_argument("--delay", default=1.0, type=float, help="Seconds between runs")
    args = parser.parse_args()

    model_id = MODELS[args.model]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = args.output or (OUTPUT_DIR / f"quality-{args.task}-{args.model}-{ts}.jsonl")
    session_id = f"scaffold-quality-{ts}"

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("[✗] OPENROUTER_API_KEY not set — export OPENROUTER_API_KEY=sk-or-v1-...")
        sys.exit(1)
    try:
        from openai import OpenAI
    except ImportError:
        print("[✗] openai SDK not installed. Run: pip install openai")
        sys.exit(1)

    client = OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=api_key,
        default_headers={"HTTP-Referer": HTTP_REFERER, "X-Title": APP_TITLE},
    )

    print(f"Task: {args.task} | Model: {model_id} | Runs: {args.runs}")
    print(f"Session ID: {session_id}")
    print(f"Output: {output_path}\n")

    results = []
    for i in range(1, args.runs + 1):
        print(f"[{i}/{args.runs}] Running...", end=" ", flush=True)
        try:
            result = run_once(client, args.task, model_id, session_id, i)
            results.append(result)
            found = [item["id"] for item in result["items"] if item["found"]]
            print(
                f"score={result['score']:.1%}  cost=${result['cost_usd']:.5f}  "
                f"found=[{', '.join(found)}]"
            )
            with open(output_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(result, ensure_ascii=False) + "\n")
            if args.delay > 0 and i < args.runs:
                time.sleep(args.delay)
        except Exception as e:
            print(f"✗ ERROR: {e}")

    if results:
        print_summary(results, args.task, model_id)
        print(f"Results saved to: {output_path}")


if __name__ == "__main__":
    main()
