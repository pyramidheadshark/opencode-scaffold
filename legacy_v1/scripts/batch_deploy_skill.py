"""
batch_deploy_skill.py — deploy a skill to all active repos in deployed-repos.json.

Usage:
    python scripts/batch_deploy_skill.py critical-analysis
    python scripts/batch_deploy_skill.py --all   # deploy all 3 new skills
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

SCAFFOLD_ROOT = Path(__file__).parent.parent
SKILLS_DIR = SCAFFOLD_ROOT / ".claude" / "skills"
REGISTRY_PATH = SCAFFOLD_ROOT / "deployed-repos.json"

NEW_SKILLS = ["critical-analysis", "database-migration-safety", "supply-chain-auditor"]


def load_registry() -> list[dict]:
    if not REGISTRY_PATH.exists():
        print("ERROR: deployed-repos.json not found", file=sys.stderr)
        sys.exit(1)
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return data.get("deployed", [])


def get_skill_rule(skill_name: str) -> dict | None:
    rules_path = SKILLS_DIR / "skill-rules.json"
    rules_data = json.loads(rules_path.read_text(encoding="utf-8"))
    for rule in rules_data.get("rules", []):
        if rule["skill"] == skill_name:
            return rule
    return None


def deploy_skill_to_repo(skill_name: str, repo_path: Path) -> str:
    skills_dir = repo_path / ".claude" / "skills"
    if not skills_dir.exists():
        return "MISS"

    rules_path = skills_dir / "skill-rules.json"
    if not rules_path.exists():
        return "MISS"

    rules_data = json.loads(rules_path.read_text(encoding="utf-8"))
    existing_names = [r["skill"] for r in rules_data.get("rules", [])]

    already_has = skill_name in existing_names

    skill_src = SKILLS_DIR / skill_name
    skill_dst = skills_dir / skill_name
    shutil.copytree(skill_src, skill_dst, dirs_exist_ok=True)

    scaffold_rule = get_skill_rule(skill_name)
    if scaffold_rule is None:
        return "ERR: no rule in scaffold skill-rules.json"

    if already_has:
        rules_data["rules"] = [
            scaffold_rule if r["skill"] == skill_name else r
            for r in rules_data["rules"]
        ]
        action = "UPDATED"
    else:
        rules_data["rules"].append(scaffold_rule)
        action = "OK"

    rules_path.write_text(
        json.dumps(rules_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return action


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("skill", nargs="?", help="Skill name to deploy")
    parser.add_argument("--all", action="store_true", help="Deploy all new skills")
    args = parser.parse_args()

    if args.all:
        skills_to_deploy = NEW_SKILLS
    elif args.skill:
        skills_to_deploy = [args.skill]
    else:
        parser.print_help()
        sys.exit(1)

    entries = load_registry()
    active = [e for e in entries if e.get("active", True)]

    print(f"Repos in registry: {len(entries)} total, {len(active)} active")
    print(f"Skills to deploy: {', '.join(skills_to_deploy)}")
    print()

    counters: dict[str, dict[str, int]] = {
        s: {"OK": 0, "UPDATED": 0, "MISS": 0, "ERR": 0} for s in skills_to_deploy
    }

    for entry in active:
        repo_path = Path(entry.get("path", ""))
        label = repo_path.name or str(repo_path)

        for skill_name in skills_to_deploy:
            if not repo_path.exists():
                result = "MISS"
            else:
                result = deploy_skill_to_repo(skill_name, repo_path)

            key = result if result in ("OK", "UPDATED", "MISS") else "ERR"
            counters[skill_name][key] += 1
            print(f"  [{result:8s}] {label} / {skill_name}")

    print()
    print("Summary:")
    for skill_name in skills_to_deploy:
        c = counters[skill_name]
        print(
            f"  {skill_name}: OK={c['OK']} UPDATED={c['UPDATED']} "
            f"MISS={c['MISS']} ERR={c['ERR']}"
        )


if __name__ == "__main__":
    main()
