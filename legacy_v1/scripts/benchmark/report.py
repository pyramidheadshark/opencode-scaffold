#!/usr/bin/env python3
"""
Generates comparison report (Markdown + PNG graphs) from benchmark JSONL output.

Usage:
  python scripts/benchmark/report.py
    [--baseline PATH]   (default: latest run-baseline-*.jsonl in output/)
    [--optimized PATH]  (default: latest run-optimized-*.jsonl in output/)
    [--output PATH]     (default: dev/benchmark-log.md)
"""
import argparse
import base64
import io
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Fix Windows cp1251 encoding for Unicode symbols
if sys.stdout.encoding and sys.stdout.encoding.lower() in ("cp1251", "cp1252", "ascii"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

OUTPUT_DIR = Path(__file__).parent / "output"
REPO_ROOT = Path(__file__).parent.parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "dev" / "benchmark-log.md"


def find_latest(prefix: str) -> Path | None:
    files = sorted(OUTPUT_DIR.glob(f"run-{prefix}-*.jsonl"), reverse=True)
    return files[0] if files else None


def load_jsonl(path: Path) -> list[dict]:
    results = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                results.append(json.loads(line))
    return results


def merge_results(baseline: list[dict], optimized: list[dict]) -> list[dict]:
    base_map = {r["id"]: r for r in baseline}
    opt_map = {r["id"]: r for r in optimized}
    all_ids = list(dict.fromkeys([r["id"] for r in baseline] + [r["id"] for r in optimized]))
    merged = []
    for tid in all_ids:
        b = base_map.get(tid)
        o = opt_map.get(tid)
        if b and o:
            in_savings = b["input_tokens"] - o["input_tokens"]
            in_savings_pct = (in_savings / b["input_tokens"] * 100) if b["input_tokens"] > 0 else 0.0
            cost_savings = b["cost_usd"] - o["cost_usd"]
            merged.append({
                "id": tid,
                "category": b.get("category", "?"),
                "name": b.get("name", tid),
                "baseline_in": b["input_tokens"],
                "optimized_in": o["input_tokens"],
                "baseline_out": b["output_tokens"],
                "optimized_out": o["output_tokens"],
                "baseline_cost": b["cost_usd"],
                "optimized_cost": o["cost_usd"],
                "in_savings": in_savings,
                "in_savings_pct": round(in_savings_pct, 1),
                "cost_savings": round(cost_savings, 6),
            })
    return merged


def build_markdown_table(merged: list[dict]) -> str:
    lines = []
    lines.append("| Task | Category | Baseline (tok) | Optimized (tok) | Savings | Savings% | Cost Base | Cost Opt |")
    lines.append("|---|---|---:|---:|---:|---:|---:|---:|")
    for r in merged:
        savings_sign = "-" if r["in_savings"] > 0 else ("+" if r["in_savings"] < 0 else "")
        lines.append(
            f"| {r['id']} | {r['category']} | "
            f"{r['baseline_in']:,} | {r['optimized_in']:,} | "
            f"{savings_sign}{abs(r['in_savings']):,} | {r['in_savings_pct']}% | "
            f"${r['baseline_cost']:.5f} | ${r['optimized_cost']:.5f} |"
        )
    total_bin = sum(r["baseline_in"] for r in merged)
    total_oin = sum(r["optimized_in"] for r in merged)
    total_savings = total_bin - total_oin
    total_pct = round(total_savings / total_bin * 100, 1) if total_bin > 0 else 0.0
    total_bcost = sum(r["baseline_cost"] for r in merged)
    total_ocost = sum(r["optimized_cost"] for r in merged)
    lines.append(
        f"| **TOTAL** | | **{total_bin:,}** | **{total_oin:,}** | "
        f"**{total_savings:+,}** | **{total_pct}%** | "
        f"**${total_bcost:.5f}** | **${total_ocost:.5f}** |"
    )
    return "\n".join(lines)


def build_category_summary(merged: list[dict]) -> str:
    from collections import defaultdict
    cat_data = defaultdict(lambda: {"baseline_in": 0, "optimized_in": 0, "count": 0})
    for r in merged:
        cat = r["category"]
        cat_data[cat]["baseline_in"] += r["baseline_in"]
        cat_data[cat]["optimized_in"] += r["optimized_in"]
        cat_data[cat]["count"] += 1
    lines = ["| Category | Tasks | Avg Baseline | Avg Optimized | Avg Savings% |"]
    lines.append("|---|---:|---:|---:|---:|")
    for cat, d in sorted(cat_data.items()):
        avg_b = d["baseline_in"] // d["count"]
        avg_o = d["optimized_in"] // d["count"]
        pct = round((avg_b - avg_o) / avg_b * 100, 1) if avg_b > 0 else 0.0
        lines.append(f"| {cat} | {d['count']} | {avg_b:,} | {avg_o:,} | {pct}% |")
    return "\n".join(lines)


def png_to_base64(fig) -> str:
    import matplotlib.pyplot as plt
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


def make_bar_chart(merged: list[dict]) -> str:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    ids = [r["id"] for r in merged]
    baseline = [r["baseline_in"] for r in merged]
    optimized = [r["optimized_in"] for r in merged]
    x = np.arange(len(ids))
    width = 0.4

    fig, ax = plt.subplots(figsize=(max(14, len(ids) * 0.8), 6))
    b1 = ax.bar(x - width / 2, baseline, width, label="Baseline", color="#4C72B0", alpha=0.85)
    b2 = ax.bar(x + width / 2, optimized, width, label="Optimized", color="#55A868", alpha=0.85)

    for rect_b, rect_o, r in zip(b1, b2, merged):
        if r["in_savings_pct"] != 0:
            ax.annotate(
                f"{r['in_savings_pct']:+.0f}%",
                xy=(rect_o.get_x() + rect_o.get_width() / 2, rect_o.get_height()),
                xytext=(0, 4), textcoords="offset points",
                ha="center", va="bottom", fontsize=7,
                color="#c0392b" if r["in_savings_pct"] < 0 else "#27ae60",
            )

    ax.set_xlabel("Task ID", fontsize=10)
    ax.set_ylabel("Input Tokens", fontsize=10)
    ax.set_title("Input Tokens: Baseline vs Optimized", fontsize=12, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(ids, rotation=45, ha="right", fontsize=7)
    ax.legend(fontsize=9)
    ax.grid(axis="y", alpha=0.4)
    fig.tight_layout()
    b64 = png_to_base64(fig)
    plt.close(fig)
    return b64


def make_category_chart(merged: list[dict]) -> str:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np
    from collections import defaultdict

    cat_data = defaultdict(lambda: {"baseline": [], "optimized": []})
    for r in merged:
        cat_data[r["category"]]["baseline"].append(r["baseline_in"])
        cat_data[r["category"]]["optimized"].append(r["optimized_in"])

    categories = sorted(cat_data.keys())
    avg_savings_pct = []
    for cat in categories:
        b_avg = sum(cat_data[cat]["baseline"]) / len(cat_data[cat]["baseline"])
        o_avg = sum(cat_data[cat]["optimized"]) / len(cat_data[cat]["optimized"])
        pct = (b_avg - o_avg) / b_avg * 100 if b_avg > 0 else 0.0
        avg_savings_pct.append(pct)

    overall_avg = sum(avg_savings_pct) / len(avg_savings_pct) if avg_savings_pct else 0.0

    fig, ax = plt.subplots(figsize=(8, 5))
    colors = ["#55A868" if v > 0 else "#C44E52" for v in avg_savings_pct]
    bars = ax.bar(categories, avg_savings_pct, color=colors, alpha=0.85)
    ax.axhline(overall_avg, color="#4C72B0", linestyle="--", linewidth=1.5,
               label=f"Overall avg: {overall_avg:.1f}%")

    for bar, val in zip(bars, avg_savings_pct):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.2,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=9, fontweight="bold")

    ax.set_xlabel("Category", fontsize=10)
    ax.set_ylabel("Avg Input Token Savings %", fontsize=10)
    ax.set_title("Token Savings by Category", fontsize=12, fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(axis="y", alpha=0.4)
    fig.tight_layout()
    b64 = png_to_base64(fig)
    plt.close(fig)
    return b64


def make_cost_pie(merged: list[dict]) -> str:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    total_bcost = sum(r["baseline_cost"] for r in merged)
    total_ocost = sum(r["optimized_cost"] for r in merged)
    cost_savings = total_bcost - total_ocost

    labels = ["Baseline cost", "Optimized cost", "Savings"]
    values = [total_bcost, total_ocost, max(cost_savings, 0)]
    colors = ["#4C72B0", "#55A868", "#F0E442"]
    explode = [0.05, 0.05, 0.1]

    non_zero = [(l, v, c, e) for l, v, c, e in zip(labels, values, colors, explode) if v > 0]
    if not non_zero:
        return ""
    labels, values, colors, explode = zip(*non_zero)

    fig, ax = plt.subplots(figsize=(7, 5))
    wedges, texts, autotexts = ax.pie(
        values, labels=labels, colors=colors, explode=explode,
        autopct=lambda p: f"${p * sum(values) / 100:.5f}\n({p:.1f}%)",
        startangle=90, pctdistance=0.75,
    )
    for at in autotexts:
        at.set_fontsize(8)
    ax.set_title("Cost Distribution: Baseline vs Optimized", fontsize=12, fontweight="bold")
    fig.tight_layout()
    b64 = png_to_base64(fig)
    plt.close(fig)
    return b64


def build_report(merged: list[dict], baseline_path: Path, optimized_path: Path) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    total_bin = sum(r["baseline_in"] for r in merged)
    total_oin = sum(r["optimized_in"] for r in merged)
    total_savings = total_bin - total_oin
    total_pct = round(total_savings / total_bin * 100, 1) if total_bin > 0 else 0.0

    lines = [
        f"# Benchmark Log — token-optimization",
        f"",
        f"*Generated: {now}*",
        f"",
        f"## Summary",
        f"",
        f"| | Value |",
        f"|---|---|",
        f"| Baseline file | `{baseline_path.name}` |",
        f"| Optimized file | `{optimized_path.name}` |",
        f"| Tasks compared | {len(merged)} |",
        f"| Total baseline input tokens | {total_bin:,} |",
        f"| Total optimized input tokens | {total_oin:,} |",
        f"| **Total savings** | **{total_savings:+,} ({total_pct}%)** |",
        f"",
        f"## Category Summary",
        f"",
        build_category_summary(merged),
        f"",
        f"## Task-level Comparison",
        f"",
        build_markdown_table(merged),
        f"",
    ]

    print("Generating graphs...")
    try:
        b64_bar = make_bar_chart(merged)
        lines += [
            "## Graph 1: Input Tokens per Task",
            "",
            f"![Input Tokens Comparison](data:image/png;base64,{b64_bar})",
            "",
        ]
        print("  [✓] Bar chart generated")
    except Exception as e:
        lines.append(f"*[Bar chart generation failed: {e}]*\n")

    try:
        b64_cat = make_category_chart(merged)
        lines += [
            "## Graph 2: Savings by Category",
            "",
            f"![Category Savings](data:image/png;base64,{b64_cat})",
            "",
        ]
        print("  [✓] Category chart generated")
    except Exception as e:
        lines.append(f"*[Category chart generation failed: {e}]*\n")

    try:
        b64_pie = make_cost_pie(merged)
        if b64_pie:
            lines += [
                "## Graph 3: Cost Breakdown",
                "",
                f"![Cost Breakdown](data:image/png;base64,{b64_pie})",
                "",
            ]
            print("  [✓] Cost pie chart generated")
    except Exception as e:
        lines.append(f"*[Cost pie generation failed: {e}]*\n")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Benchmark report generator")
    parser.add_argument("--baseline", default=None, type=Path)
    parser.add_argument("--optimized", default=None, type=Path)
    parser.add_argument("--output", default=DEFAULT_OUTPUT, type=Path)
    args = parser.parse_args()

    baseline_path = args.baseline or find_latest("baseline")
    optimized_path = args.optimized or find_latest("optimized")

    if not baseline_path or not baseline_path.exists():
        print(f"[✗] Baseline results not found. Run: python scripts/benchmark/token_runner.py --mode baseline")
        return
    if not optimized_path or not optimized_path.exists():
        print(f"[✗] Optimized results not found. Run: python scripts/benchmark/token_runner.py --mode optimized")
        return

    print(f"Loading baseline: {baseline_path}")
    print(f"Loading optimized: {optimized_path}")

    baseline = load_jsonl(baseline_path)
    optimized = load_jsonl(optimized_path)
    merged = merge_results(baseline, optimized)

    if not merged:
        print("[✗] No matching tasks found between baseline and optimized runs.")
        return

    print(f"Matched {len(merged)} tasks. Generating report...")
    report = build_report(merged, baseline_path, optimized_path)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"\n[✓] Report written to: {args.output}")
    total_bin = sum(r["baseline_in"] for r in merged)
    total_oin = sum(r["optimized_in"] for r in merged)
    total_pct = round((total_bin - total_oin) / total_bin * 100, 1) if total_bin > 0 else 0
    print(f"    Total savings: {total_bin - total_oin:+,} tokens ({total_pct}%)")


if __name__ == "__main__":
    main()
