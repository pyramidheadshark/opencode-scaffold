#!/usr/bin/env python3
"""
Benchmark runner — measures input/output tokens for baseline vs optimized mode via OpenRouter.

Usage:
  python scripts/benchmark/token_runner.py --mode baseline [--model haiku|sonnet] [--dry-run]
  python scripts/benchmark/token_runner.py --mode optimized [--model haiku|sonnet]

Writes JSONL to scripts/benchmark/output/run-{mode}-{timestamp}.jsonl
Each entry includes generation_id for correlation with OpenRouter dashboard.

OpenRouter dashboard: https://openrouter.ai/activity
"""
import argparse
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
TASKS_FILE = Path(__file__).parent / "tasks.json"
OUTPUT_DIR = Path(__file__).parent / "output"

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
HTTP_REFERER = "https://github.com/pyramidheadshark/claude-scaffold"
APP_TITLE = "claude-scaffold benchmark"

MODELS = {
    "haiku":  "anthropic/claude-haiku-4.5",
    "sonnet": "anthropic/claude-sonnet-4.6",
}

# Prices in USD per token (OpenRouter rates as of 2026-04)
PRICES = {
    "anthropic/claude-haiku-4.5":  {"input": 0.80e-6, "output": 4.00e-6},
    "anthropic/claude-sonnet-4.6": {"input": 3.00e-6, "output": 15.00e-6},
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
    prices = PRICES.get(model, PRICES["anthropic/claude-haiku-4.5"])
    return input_tokens * prices["input"] + output_tokens * prices["output"]


def run_task(client, task: dict, mode: str, model: str, dry_run: bool,
             session_id: str) -> dict:
    messages = build_messages(task, mode)
    system_prompt = get_system_prompt(task, mode)
    total_chars = sum(len(m["content"]) for m in messages) + len(system_prompt)

    if dry_run:
        print(
            f"  [dry] {task['id']} | {task['category']} "
            f"| sys={len(system_prompt)} chars | msgs={len(messages)} | total_chars={total_chars}"
        )
        return {
            "id": task["id"], "category": task["category"], "name": task.get("name", task["id"]),
            "mode": mode, "model": model,
            "input_tokens": 0, "output_tokens": 0, "cached_tokens": 0,
            "cost_usd": 0.0, "generation_id": None,
            "ts": datetime.now(timezone.utc).isoformat(), "dry_run": True,
        }

    # Build messages with system prompt as first message (OpenAI format)
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    response = client.chat.completions.create(
        model=model,
        max_tokens=512,
        messages=full_messages,
        extra_headers={
            "x-session-id": session_id,
        },
    )

    usage = response.usage
    input_tokens = usage.prompt_tokens
    output_tokens = usage.completion_tokens

    # Cache tokens from prompt_tokens_details (if present)
    details = getattr(usage, "prompt_tokens_details", None)
    cached_tokens = getattr(details, "cached_tokens", 0) if details else 0

    cost = calc_cost(input_tokens, output_tokens, model)
    generation_id = response.id

    return {
        "id": task["id"],
        "category": task["category"],
        "name": task.get("name", task["id"]),
        "mode": mode,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cached_tokens": cached_tokens or 0,
        "cost_usd": round(cost, 6),
        "generation_id": generation_id,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def print_summary(results: list[dict], mode: str, model: str, session_id: str):
    total_in = sum(r["input_tokens"] for r in results)
    total_out = sum(r["output_tokens"] for r in results)
    total_cached = sum(r.get("cached_tokens", 0) for r in results)
    total_cost = sum(r["cost_usd"] for r in results)

    print(f"\n{'='*72}")
    print(f"  Mode: {mode}  |  Model: {model}  |  Tasks: {len(results)}")
    print(f"  Session ID: {session_id}")
    print(f"{'='*72}")
    print(f"  {'ID':<32} {'In':>7} {'Cached':>7} {'Out':>6} {'Cost':>10}")
    print(f"  {'-'*32} {'------':>7} {'------':>7} {'----':>6} {'--------':>10}")
    for r in results:
        cached_str = f"{r.get('cached_tokens', 0):>7}" if r.get("cached_tokens") else "      -"
        print(
            f"  {r['id']:<32} {r['input_tokens']:>7} {cached_str} "
            f"{r['output_tokens']:>6}  ${r['cost_usd']:>8.5f}"
        )
    print(f"  {'-'*32} {'------':>7} {'------':>7} {'----':>6} {'--------':>10}")
    print(
        f"  {'TOTAL':<32} {total_in:>7} {total_cached:>7} "
        f"{total_out:>6}  ${total_cost:>8.5f}"
    )
    print(f"\n  OpenRouter dashboard: https://openrouter.ai/activity")
    print(f"  Filter by session: {session_id}")
    print()


def main():
    # Fix Windows cp1251 encoding
    if sys.stdout.encoding and sys.stdout.encoding.lower() in ("cp1251", "cp1252", "ascii"):
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Token benchmark runner (OpenRouter)")
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

    # Unique session ID groups all tasks of this run in OpenRouter dashboard
    session_id = f"scaffold-bench-{ts}"

    tasks = load_tasks(args.tasks)
    print(f"Loaded {len(tasks)} tasks from {args.tasks}")
    print(f"Mode: {args.mode} | Model: {model_id} | Dry-run: {args.dry_run}")
    print(f"Session ID: {session_id}")
    print(f"Output: {output_path}\n")

    if not args.dry_run:
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
            default_headers={
                "HTTP-Referer": HTTP_REFERER,
                "X-Title": APP_TITLE,
            },
        )
    else:
        client = None

    results = []
    for i, task in enumerate(tasks, 1):
        print(f"[{i:2}/{len(tasks)}] {task['id']} ({task['category']})", end=" ", flush=True)
        try:
            result = run_task(client, task, args.mode, model_id, args.dry_run, session_id)
            results.append(result)
            if not args.dry_run:
                cached_str = f" cached={result['cached_tokens']}" if result["cached_tokens"] else ""
                print(
                    f"→ in={result['input_tokens']}{cached_str} "
                    f"out={result['output_tokens']} ${result['cost_usd']:.5f} "
                    f"[{result['generation_id'][:16]}...]"
                )
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
                "input_tokens": 0, "output_tokens": 0, "cached_tokens": 0,
                "cost_usd": 0.0, "generation_id": None,
                "error": str(e), "ts": datetime.now(timezone.utc).isoformat(),
            })

    if not args.dry_run:
        print_summary(results, args.mode, model_id, session_id)
        print(f"Results saved to: {output_path}")
        print(f"Run 'python scripts/benchmark/report.py' to generate comparison report.")


if __name__ == "__main__":
    main()
