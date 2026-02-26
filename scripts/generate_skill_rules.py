#!/usr/bin/env python3
"""
generate_skill_rules.py — filter skill-rules.json to only include selected skills.

Usage:
    python generate_skill_rules.py <source-rules.json> <output-rules.json> skill1 skill2 ...
"""
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: generate_skill_rules.py <source> <output> skill1 [skill2 ...]", file=sys.stderr)
        sys.exit(1)

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    selected = set(sys.argv[3:])

    with open(source_path, encoding="utf-8") as f:
        rules = json.load(f)

    original_rules = rules.get("rules", [])
    filtered_rules = [r for r in original_rules if r.get("skill") in selected]

    for i, rule in enumerate(filtered_rules, start=1):
        rule["priority"] = i

    rules["rules"] = filtered_rules

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)

    print(f"  Generated skill-rules.json with {len(filtered_rules)} skills")


if __name__ == "__main__":
    main()
