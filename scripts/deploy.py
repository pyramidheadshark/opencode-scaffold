#!/usr/bin/env python3
"""
deploy.py — cross-platform deploy script for ml-claude-infra.

Copies hooks, agents, commands, and selected skills into a target project.
Works on Windows, Linux, and macOS with Python 3.11+.

Usage:
    python scripts/deploy.py                               # interactive wizard
    python scripts/deploy.py <target> --all                # all non-meta skills
    python scripts/deploy.py <target> --all --include-meta # include meta-skills
    python scripts/deploy.py <target> --skills a,b,c       # selected skills
    python scripts/deploy.py <target> --all --with-tests   # include test suite
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

INFRA_DIR = Path(__file__).resolve().parent.parent
SKILLS_DIR = INFRA_DIR / ".claude" / "skills"

SKILLS: list[tuple[str, str]] = [
    ("python-project-standards", "Python setup: pyproject.toml, uv, ruff, mypy, pre-commit"),
    ("fastapi-patterns",         "FastAPI: routers, dependency injection, middleware, lifespan"),
    ("htmx-frontend",            "HTMX + Jinja2 server-side rendering"),
    ("ml-data-handling",         "ML artifacts: pickle, ONNX, Parquet, S3"),
    ("multimodal-router",        "Route PDF/image/video to Gemini via OpenRouter"),
    ("langgraph-patterns",       "LangGraph agent graphs, state machines, checkpointers"),
    ("rag-vector-db",            "Qdrant/pgvector, embeddings, chunking, RAG"),
    ("nlp-slm-patterns",         "Presidio, spaCy, Ollama, vLLM, PII anonymization"),
    ("predictive-analytics",     "sklearn, MLflow, feature engineering, Optuna, SHAP"),
    ("infra-yandex-cloud",       "Terraform, Packer, Helm, Yandex Cloud deploy"),
    ("test-first-patterns",      "pytest, BDD/Gherkin, fixtures, coverage, TDD"),
    ("github-actions",           "CI/CD workflows: lint, test, docker build, YC deploy"),
]

META_SKILLS: list[tuple[str, str]] = [
    ("design-doc-creator", "Design doc wizard (use only during project design phase)"),
    ("skill-developer",    "Skill authoring tools (use only when extending ml-claude-infra)"),
]

PROJECT_PRESETS: dict[str, list[str]] = {
    "FastAPI REST API":    ["python-project-standards", "fastapi-patterns", "test-first-patterns", "github-actions"],
    "ML pipeline":         ["python-project-standards", "ml-data-handling", "predictive-analytics", "test-first-patterns"],
    "RAG / LLM app":       ["fastapi-patterns", "rag-vector-db", "langgraph-patterns", "github-actions"],
    "NLP / anonymization": ["python-project-standards", "nlp-slm-patterns", "test-first-patterns"],
    "Full ML platform":    [s for s, _ in SKILLS],
}


def _hr(width: int = 60) -> None:
    print("-" * width)


def _header(text: str) -> None:
    _hr()
    print(f"  {text}")
    _hr()


def _confirm(prompt: str, default: bool = False) -> bool:
    suffix = " [Y/n]" if default else " [y/N]"
    try:
        raw = input(prompt + suffix + " ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)
    if raw == "":
        return default
    return raw in ("y", "yes")


def _choose_str(prompt: str) -> str:
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)


def interactive_wizard() -> argparse.Namespace:
    print()
    _header("ml-claude-infra :: Deploy Wizard")
    print()

    raw = _choose_str("  Target project directory: ")
    target = Path(raw).expanduser().resolve()

    print()
    print("  Presets:")
    print("  " + "-" * 54)
    preset_list = list(PROJECT_PRESETS.keys())
    for i, name in enumerate(preset_list, 1):
        print(f"    {i}. {name}")
    print(f"    0. Custom - select skills manually")
    print("  " + "-" * 54)
    print()

    choice = _choose_str("  Preset number (or 0 for custom): ").strip()
    selected: list[str] = []

    if choice.isdigit() and 1 <= int(choice) <= len(preset_list):
        preset_name = preset_list[int(choice) - 1]
        selected = PROJECT_PRESETS[preset_name]
        print(f"\n  Selected preset: {preset_name}")
        print(f"  Skills: {', '.join(selected)}")
    else:
        print()
        print("  Available Skills:")
        print("  " + "-" * 54)
        all_skills = SKILLS + META_SKILLS
        for i, (name, desc) in enumerate(all_skills, 1):
            meta_tag = " [meta]" if (name, desc) in META_SKILLS else ""
            print(f"    {i:>2}. {name:<30} {desc[:25]}{meta_tag}")
        print("  " + "-" * 54)
        print()
        raw_sel = _choose_str("  Enter numbers separated by spaces (or 'all'): ").strip()

        if raw_sel.lower() == "all":
            selected = [s for s, _ in SKILLS]
        else:
            indices = [int(x) - 1 for x in raw_sel.split() if x.isdigit()]
            all_skill_names = [s for s, _ in SKILLS + META_SKILLS]
            selected = [all_skill_names[i] for i in indices if 0 <= i < len(all_skill_names)]

    print()
    include_meta = any(s in selected for s in [n for n, _ in META_SKILLS])
    if not include_meta:
        if _confirm("  Include meta-skills (design-doc-creator, skill-developer)?", default=False):
            selected += [n for n, _ in META_SKILLS]

    with_tests = _confirm("  Include test suite (Jest + Python)?", default=False)

    print()
    return argparse.Namespace(
        target=str(target),
        all=False,
        skills=",".join(selected),
        with_tests=with_tests,
        include_meta=include_meta,
    )


def copy_dir_contents(src: Path, dst: Path, glob: str = "*") -> None:
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.glob(glob):
        dest_item = dst / item.name
        if item.is_dir():
            shutil.copytree(item, dest_item, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest_item)


def generate_skill_rules(
    source_rules: dict,
    selected: list[str],
    exclude_optional: bool,
) -> dict:
    original = source_rules.get("rules", [])
    source_map = {r["skill"]: r for r in original}
    filtered = [r for r in original if r.get("skill") in selected]
    if exclude_optional:
        filtered = [r for r in filtered if not source_map.get(r["skill"], {}).get("optional", False)]
    for i, rule in enumerate(filtered, start=1):
        rule["priority"] = i
    result = dict(source_rules)
    result["rules"] = filtered
    return result


def deploy(args: argparse.Namespace) -> None:
    target = Path(args.target).expanduser().resolve()

    if args.all:
        selected = [s for s, _ in SKILLS]
        if args.include_meta:
            selected += [s for s, _ in META_SKILLS]
    elif args.skills:
        selected = [s.strip() for s in args.skills.split(",") if s.strip()]
    else:
        selected = []

    if not selected:
        print("ERROR: no skills selected", file=sys.stderr)
        sys.exit(1)

    include_meta = getattr(args, "include_meta", False)

    print()
    _header("ml-claude-infra :: Deploy")
    print(f"  Source       : {INFRA_DIR}")
    print(f"  Target       : {target}")
    print(f"  Skills       : {', '.join(selected)}")
    print(f"  Tests        : {args.with_tests}")
    print(f"  Include meta : {include_meta}")
    print()

    target.mkdir(parents=True, exist_ok=True)

    print("[1/5] Copying hooks...")
    hooks_src = INFRA_DIR / ".claude" / "hooks"
    hooks_dst = target / ".claude" / "hooks"
    hooks_dst.mkdir(parents=True, exist_ok=True)
    for f in hooks_src.iterdir():
        if f.is_file():
            shutil.copy2(f, hooks_dst / f.name)

    print("[2/5] Copying agents...")
    copy_dir_contents(INFRA_DIR / ".claude" / "agents", target / ".claude" / "agents", "*.md")

    print("[3/5] Copying commands...")
    copy_dir_contents(INFRA_DIR / ".claude" / "commands", target / ".claude" / "commands", "*.md")

    print("[4/5] Copying selected skills...")
    skills_dst = target / ".claude" / "skills"
    skills_dst.mkdir(parents=True, exist_ok=True)

    for skill_name in selected:
        skill_src = SKILLS_DIR / skill_name
        if not skill_src.exists():
            print(f"  WARN: skill '{skill_name}' not found, skipping")
            continue
        print(f"  + {skill_name}")
        shutil.copytree(skill_src, skills_dst / skill_name, dirs_exist_ok=True)

    print("[4b/5] Generating skill-rules.json...")
    rules_src_path = SKILLS_DIR / "skill-rules.json"
    with open(rules_src_path, encoding="utf-8") as f:
        source_rules = json.load(f)

    rules_out = generate_skill_rules(source_rules, selected, exclude_optional=not include_meta)

    rules_dst_path = skills_dst / "skill-rules.json"
    with open(rules_dst_path, "w", encoding="utf-8") as f:
        json.dump(rules_out, f, ensure_ascii=False, indent=2)
    print(f"  Generated with {len(rules_out['rules'])} skills")

    print("[5/5] Creating dev/status.md...")
    status_dst = target / "dev" / "status.md"
    if not status_dst.exists():
        status_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(INFRA_DIR / "templates" / "status.md", status_dst)
        print("  Created dev/status.md from template")
    else:
        print("  dev/status.md already exists, skipping")

    if args.with_tests:
        print("[+] Copying test suite...")
        shutil.copytree(INFRA_DIR / "tests" / "hook", target / "tests" / "hook", dirs_exist_ok=True)
        shutil.copytree(INFRA_DIR / "tests" / "fixtures", target / "tests" / "fixtures", dirs_exist_ok=True)
        shutil.copytree(INFRA_DIR / "tests" / "infra", target / "tests" / "infra", dirs_exist_ok=True)
        shutil.copy2(INFRA_DIR / "package.json", target / "package.json")

    print()
    _header("Done!")
    print()
    print("  Next steps:")
    print(f"  1. Edit {target / 'dev' / 'status.md'}")
    print(f"     Fill in: Business Goal, Current Phase, Next Session Plan")
    print()
    print(f"  2. Copy and adapt CLAUDE.md:")
    print(f"     cp {INFRA_DIR / '.claude' / 'CLAUDE.md'} {target / '.claude' / 'CLAUDE.md'}")
    print()
    if args.with_tests:
        print("  3. Run tests to verify deploy:")
        print(f"     cd {target} && npm install && npm run test:hook")
        print()
    print("  4. Verify hook in Claude Code:")
    print('     echo \'{"prompt":"pyproject.toml ruff"}\' | node .claude/hooks/skill-activation-prompt.js')
    print()


def main() -> None:
    if len(sys.argv) == 1:
        args = interactive_wizard()
        deploy(args)
        return

    parser = argparse.ArgumentParser(
        description="Deploy ml-claude-infra into a target project.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\n".join([
            "Examples:",
            "  python scripts/deploy.py ~/Repos/my-project --all",
            "  python scripts/deploy.py ~/Repos/my-project --all --include-meta --with-tests",
            "  python scripts/deploy.py ~/Repos/my-project --skills python-project-standards,fastapi-patterns",
        ]),
    )
    parser.add_argument("target", help="Target project directory")
    parser.add_argument("--all", action="store_true", help="Include all non-meta skills")
    parser.add_argument("--skills", default="", help="Comma-separated skill list")
    parser.add_argument("--include-meta", action="store_true", dest="include_meta",
                        help="Include meta-skills (design-doc-creator, skill-developer)")
    parser.add_argument("--with-tests", action="store_true", dest="with_tests",
                        help="Copy test suite into target project")

    args = parser.parse_args()

    if not args.all and not args.skills:
        parser.error("Specify --all or --skills <list>")

    deploy(args)


if __name__ == "__main__":
    main()
