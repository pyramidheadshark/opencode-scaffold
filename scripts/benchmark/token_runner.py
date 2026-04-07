#!/usr/bin/env python3
"""
Benchmark runner — measures input/output tokens for baseline vs optimized mode.

Usage:
  python scripts/benchmark/token_runner.py --mode baseline [--model haiku|sonnet] [--dry-run]
  python scripts/benchmark/token_runner.py --mode optimized [--model haiku|sonnet]

Writes JSONL to scripts/benchmark/output/run-{mode}-{timestamp}.jsonl
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
TASKS_FILE = Path(__file__).parent / "tasks.json"
OUTPUT_DIR = Path(__file__).parent / "output"

MODELS = {
    "haiku": "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-6",
}

PRICES = {
    "claude-haiku-4-5-20251001": {"input": 0.80e-6, "output": 4.00e-6},
    "claude-sonnet-4-6":         {"input": 3.00e-6, "output": 15.00e-6},
}


def load_tasks(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_messages(task: dict, mode: str) -> list[dict]:
    key = f"messages_{mode}"
    msgs = task.get(key, task.get("messages_baseline", []))
    final_msg = {"role": "user", "content": task["user_message"]}
    return [*msgs, final_msg]


def get_system_prompt(task: dict, mode: str) -> str:
    key = f"system_prompt_{mode}"
    return task.get(key, task.get("system_prompt_baseline", ""))


def calc_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    prices = PRICES.get(model, PRICES["claude-haiku-4-5-20251001"])
    return input_tokens * prices["input"] + output_tokens * prices["output"]


def run_task(client, task: dict, mode: str, model: str, dry_run: bool) -> dict:
    messages = build_messages(task, mode)
    system_prompt = get_system_prompt(task, mode)
    total_chars = sum(len(m["content"]) for m in messages) + len(system_prompt)

    if dry_run:
        print(f"  [dry] {task['id']} | {task['category']} | sys={len(system_prompt)} chars | msgs={len(messages)} | total_chars={total_chars}")
        return {
            "id": task["id"], "category": task["category"],
            "mode": mode, "model": model,
            "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0,
            "ts": datetime.now(timezone.utc).isoformat(), "dry_run": True,
        }

    response = client.messages.create(
        model=model,
        max_tokens=512,
        system=system_prompt,
        messages=messages,
    )
    usage = response.usage
    input_tokens = usage.input_tokens
    output_tokens = usage.output_tokens
    cost = calc_cost(input_tokens, output_tokens, model)

    return {
        "id": task["id"],
        "category": task["category"],
        "name": task.get("name", task["id"]),
        "mode": mode,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost, 6),
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def print_summary(results: list[dict], mode: str, model: str):
    total_in = sum(r["input_tokens"] for r in results)
    total_out = sum(r["output_tokens"] for r in results)
    total_cost = sum(r["cost_usd"] for r in results)

    print(f"\n{'='*60}")
    print(f"  Mode: {mode}  |  Model: {model}  |  Tasks: {len(results)}")
    print(f"{'='*60}")
    print(f"  {'ID':<30} {'In':>6} {'Out':>6} {'Cost':>10}")
    print(f"  {'-'*30} {'----':>6} {'----':>6} {'--------':>10}")
    for r in results:
        print(f"  {r['id']:<30} {r['input_tokens']:>6} {r['output_tokens']:>6}  ${r['cost_usd']:>8.5f}")
    print(f"  {'-'*30} {'----':>6} {'----':>6} {'--------':>10}")
    print(f"  {'TOTAL':<30} {total_in:>6} {total_out:>6}  ${total_cost:>8.5f}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Token benchmark runner")
    parser.add_argument("--mode", required=True, choices=["baseline", "optimized"])
    parser.add_argument("--model", default="haiku", choices=list(MODELS.keys()))
    parser.add_argument("--tasks", default=str(TASKS_FILE), type=Path)
    parser.add_argument("--output", default=None, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--delay", default=0.5, type=float,
                        help="Seconds between API calls (default: 0.5)")
    args = parser.parse_args()

    model_id = MODELS[args.model]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = args.output or (OUTPUT_DIR / f"run-{args.mode}-{ts}.jsonl")

    tasks = load_tasks(args.tasks)
    print(f"Loaded {len(tasks)} tasks from {args.tasks}")
    print(f"Mode: {args.mode} | Model: {model_id} | Dry-run: {args.dry_run}")
    print(f"Output: {output_path}\n")

    if not args.dry_run:
        try:
            import anthropic
        except ImportError:
            print("[✗] anthropic SDK not installed. Run: pip install anthropic")
            sys.exit(1)
        client = anthropic.Anthropic()
    else:
        client = None

    results = []
    for i, task in enumerate(tasks, 1):
        print(f"[{i:2}/{len(tasks)}] {task['id']} ({task['category']})", end=" ", flush=True)
        try:
            result = run_task(client, task, args.mode, model_id, args.dry_run)
            results.append(result)
            if not args.dry_run:
                print(f"→ in={result['input_tokens']} out={result['output_tokens']} ${result['cost_usd']:.5f}")
                with open(output_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(result, ensure_ascii=False) + "\n")
                if args.delay > 0 and i < len(tasks):
                    time.sleep(args.delay)
            else:
                print()
        except Exception as e:
            print(f"✗ ERROR: {e}")
            results.append({
                "id": task["id"], "category": task["category"],
                "mode": args.mode, "model": model_id,
                "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0,
                "error": str(e), "ts": datetime.now(timezone.utc).isoformat(),
            })

    if not args.dry_run:
        print_summary(results, args.mode, model_id)
        print(f"Results saved to: {output_path}")
        print(f"Run 'python scripts/benchmark/report.py' to generate comparison report.")


if __name__ == "__main__":
    main()
