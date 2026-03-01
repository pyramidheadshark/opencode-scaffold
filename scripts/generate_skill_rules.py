#!/usr/bin/env python3
"""
generate_skill_rules.py — filter skill-rules.json to only include selected skills.

Usage:
    python generate_skill_rules.py <source-rules.json> <output-rules.json> [--exclude-optional] skill1 skill2 ...
"""
import argparse
import json
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Filter skill-rules.json to selected skills only."
    )
    parser.add_argument("source", help="Path to source skill-rules.json")
    parser.add_argument("output", help="Path to output skill-rules.json")
    parser.add_argument("skills", nargs="+", help="Skill names to include")
    parser.add_argument(
        "--exclude-optional",
        action="store_true",
        help="Exclude skills marked optional:true from output",
    )
    args = parser.parse_args()

    source_path = Path(args.source)
    output_path = Path(args.output)
    selected = set(args.skills)

    with open(source_path, encoding="utf-8") as f:
        rules = json.load(f)

    original_rules = rules.get("rules", [])
    source_rules_map = {r["skill"]: r for r in original_rules}

    filtered_rules = [r for r in original_rules if r.get("skill") in selected]

    if args.exclude_optional:
        filtered_rules = [
            r for r in filtered_rules
            if not source_rules_map.get(r["skill"], {}).get("optional", False)
        ]

    for i, rule in enumerate(filtered_rules, start=1):
        rule["priority"] = i

    rules["rules"] = filtered_rules

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)

    print(f"  Generated skill-rules.json with {len(filtered_rules)} skills")


if __name__ == "__main__":
    main()
