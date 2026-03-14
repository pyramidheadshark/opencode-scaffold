#!/usr/bin/env python3
"""
deploy.py — cross-platform deploy script for claude-scaffold.

Copies hooks, agents, commands, and selected skills into a target project.
Works on Windows, Linux, and macOS with Python 3.11+.

Usage:
    python scripts/deploy.py                                          # interactive wizard
    python scripts/deploy.py <target> --all                           # all non-meta skills
    python scripts/deploy.py <target> --all --include-meta            # include meta-skills
    python scripts/deploy.py <target> --skills a,b,c                  # selected skills
    python scripts/deploy.py <target> --all --with-tests              # include test suite
    python scripts/deploy.py <target> --all --ci-profile fastapi      # add CI workflow
    python scripts/deploy.py <target> --all --ci-profile fastapi-db --deploy-target yc

    python scripts/deploy.py --status                                 # show all deployed repos + version drift
    python scripts/deploy.py --update <target>                        # update .claude/ in one repo
    python scripts/deploy.py --update-all                             # update .claude/ in all registered repos
"""
import argparse
import json
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

INFRA_DIR = Path(__file__).resolve().parent.parent
SKILLS_DIR = INFRA_DIR / ".claude" / "skills"
CI_TEMPLATES_DIR = INFRA_DIR / "templates" / "github-actions"
REGISTRY_PATH = INFRA_DIR / "deployed-repos.json"

HOOKS_DEFINITION: dict = {
    "SessionStart": [{"matcher": "", "hooks": [{"type": "command", "command": "node .claude/hooks/session-start.js"}]}],
    "UserPromptSubmit": [{"matcher": "", "hooks": [{"type": "command", "command": "node .claude/hooks/skill-activation-prompt.js"}]}],
    "PostToolUse": [{"matcher": ".*", "hooks": [{"type": "command", "command": "bash .claude/hooks/post-tool-use-tracker.sh"}]}],
    "Stop": [{"matcher": "", "hooks": [{"type": "command", "command": "bash .claude/hooks/python-quality-check.sh"}]}],
}

CI_PROFILES: list[tuple[str, str]] = [
    ("minimal",    "Lint + typecheck + test — CLI tools, data scripts, web scrapers"),
    ("fastapi",    "Lint + typecheck + test + docker-build — standard FastAPI service"),
    ("fastapi-db", "Lint + typecheck + test (Postgres) + migration-check + docker-build"),
    ("ml-heavy",   "Lint + typecheck + test (HF cache) + security scan + docker-build"),
]

DEPLOY_TARGETS: list[tuple[str, str]] = [
    ("none", "No deploy stage — CI only"),
    ("yc",   "Yandex Cloud Container Registry + Serverless Container"),
    ("vps",  "VPS / bare metal via SSH + docker-compose pull"),
]

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
    ("skill-developer",    "Skill authoring tools (use only when extending claude-scaffold)"),
]

PROJECT_PRESETS: dict[str, list[str]] = {
    "FastAPI REST API":    ["python-project-standards", "fastapi-patterns", "test-first-patterns", "github-actions"],
    "ML pipeline":         ["python-project-standards", "ml-data-handling", "predictive-analytics", "test-first-patterns"],
    "RAG / LLM app":       ["fastapi-patterns", "rag-vector-db", "langgraph-patterns", "github-actions"],
    "NLP / anonymization": ["python-project-standards", "nlp-slm-patterns", "test-first-patterns"],
    "Full ML platform":    [s for s, _ in SKILLS],
}


def _get_current_sha() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=INFRA_DIR, capture_output=True, text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else "unknown"


def _load_registry() -> dict:
    if REGISTRY_PATH.exists():
        with open(REGISTRY_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"deployed": []}


def _save_registry(registry: dict) -> None:
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)


def _register_deploy(target: Path, selected: list[str], ci_profile: str, deploy_target: str) -> None:
    sha = _get_current_sha()
    version_file = target / ".claude" / "infra-version"
    version_file.write_text(sha, encoding="utf-8")

    registry = _load_registry()
    entry = {
        "path": str(target),
        "skills": selected,
        "ci_profile": ci_profile,
        "deploy_target": deploy_target,
        "deployed_at": date.today().isoformat(),
        "infra_sha": sha,
    }
    existing = [e for e in registry["deployed"] if e["path"] == str(target)]
    if existing:
        registry["deployed"][registry["deployed"].index(existing[0])] = entry
    else:
        registry["deployed"].append(entry)
    _save_registry(registry)
    print(f"  Registered in deployed-repos.json (sha: {sha})")


def status_cmd() -> None:
    registry = _load_registry()
    current_sha = _get_current_sha()

    if not registry["deployed"]:
        print("  No deployed repos registered.")
        return

    _header(f"Deployed repos  (infra HEAD: {current_sha})")
    for entry in registry["deployed"]:
        path = Path(entry["path"])
        version_file = path / ".claude" / "infra-version"
        if not path.exists():
            status = "NOT FOUND on disk"
        elif not version_file.exists():
            status = "no version file"
        else:
            repo_sha = version_file.read_text(encoding="utf-8").strip()
            status = "up to date" if repo_sha == current_sha else f"OUTDATED ({repo_sha})"
        skills_str = ", ".join(entry.get("skills", []))
        ci_str = entry.get("ci_profile", "none")
        print(f"  {path.name:<32} [{status}]")
        print(f"    path     : {entry['path']}")
        print(f"    skills   : {skills_str}")
        print(f"    CI       : {ci_str}  deployed: {entry.get('deployed_at', '?')}")
        print()


def update_cmd(target_path: str) -> None:
    target = Path(target_path).expanduser().resolve()
    registry = _load_registry()
    entries = [e for e in registry["deployed"] if Path(e["path"]) == target]
    if not entries:
        print(f"  ERROR: {target} not found in registry.", file=sys.stderr)
        print("  Run a fresh deploy first to register it.", file=sys.stderr)
        sys.exit(1)

    entry = entries[0]
    print(f"\n  Updating: {target.name}")
    args = argparse.Namespace(
        target=str(target),
        all=False,
        skills=",".join(entry["skills"]),
        with_tests=False,
        include_meta=entry.get("include_meta", False),
        ci_profile="",
        deploy_target="none",
    )
    deploy(args)


def update_all_cmd() -> None:
    registry = _load_registry()
    if not registry["deployed"]:
        print("  No deployed repos registered.")
        return

    current_sha = _get_current_sha()
    to_update = []
    for entry in registry["deployed"]:
        path = Path(entry["path"])
        version_file = path / ".claude" / "infra-version"
        repo_sha = version_file.read_text(encoding="utf-8").strip() if version_file.exists() else ""
        if repo_sha != current_sha:
            to_update.append(entry)

    if not to_update:
        print(f"  All {len(registry['deployed'])} repos are up to date.")
        return

    print(f"  Updating {len(to_update)} of {len(registry['deployed'])} repos...\n")
    for entry in to_update:
        update_cmd(entry["path"])


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
    _header("claude-scaffold :: Deploy Wizard")
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
    print("  CI/CD Profile:")
    print("  " + "-" * 54)
    print("    0. Skip — no CI workflow")
    for i, (name, desc) in enumerate(CI_PROFILES, 1):
        print(f"    {i}. {name:<14} {desc}")
    print("  " + "-" * 54)
    print()
    ci_choice = _choose_str("  CI profile (0 to skip): ").strip()

    ci_profile = ""
    deploy_target = "none"

    if ci_choice.isdigit() and 1 <= int(ci_choice) <= len(CI_PROFILES):
        ci_profile = CI_PROFILES[int(ci_choice) - 1][0]
        print(f"\n  Selected CI profile: {ci_profile}")

        print()
        print("  Deploy target:")
        print("  " + "-" * 54)
        for i, (name, desc) in enumerate(DEPLOY_TARGETS, 1):
            print(f"    {i}. {name:<8} {desc}")
        print("  " + "-" * 54)
        print()
        dep_choice = _choose_str("  Deploy target (1 for none): ").strip()

        if dep_choice.isdigit() and 1 <= int(dep_choice) <= len(DEPLOY_TARGETS):
            deploy_target = DEPLOY_TARGETS[int(dep_choice) - 1][0]
        print(f"  Deploy target: {deploy_target}")
    else:
        print("  Skipping CI workflow.")

    print()
    return argparse.Namespace(
        target=str(target),
        all=False,
        skills=",".join(selected),
        with_tests=with_tests,
        include_meta=include_meta,
        ci_profile=ci_profile,
        deploy_target=deploy_target,
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


def deploy_settings(target: Path) -> None:
    settings_path = target / ".claude" / "settings.json"
    existing: dict = {}
    if settings_path.exists():
        try:
            existing = json.loads(settings_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            existing = {}
    existing["hooks"] = HOOKS_DEFINITION
    settings_path.write_text(
        json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def deploy_ci(target: Path, ci_profile: str, deploy_target: str) -> None:
    ci_src = CI_TEMPLATES_DIR / f"{ci_profile}.yml"
    if not ci_src.exists():
        print(f"  WARN: CI template '{ci_profile}.yml' not found, skipping")
        return

    workflows_dir = target / ".github" / "workflows"
    workflows_dir.mkdir(parents=True, exist_ok=True)
    ci_dst = workflows_dir / "ci.yml"

    if ci_dst.exists():
        print("  .github/workflows/ci.yml already exists, skipping (no overwrite)")
    else:
        shutil.copy2(ci_src, ci_dst)
        print(f"  Created .github/workflows/ci.yml (profile: {ci_profile})")

    if deploy_target and deploy_target != "none":
        deploy_src = CI_TEMPLATES_DIR / "deploy" / f"{deploy_target}.yml"
        deploy_dst = workflows_dir / "deploy.yml"
        if not deploy_src.exists():
            print(f"  WARN: deploy template '{deploy_target}.yml' not found, skipping")
        elif deploy_dst.exists():
            print("  .github/workflows/deploy.yml already exists, skipping (no overwrite)")
        else:
            shutil.copy2(deploy_src, deploy_dst)
            print(f"  Created .github/workflows/deploy.yml (target: {deploy_target})")


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
    _header("claude-scaffold :: Deploy")
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

    print("[5b/5] Ensuring .claude/ is excluded from git...")
    gitignore_path = target / ".gitignore"
    claude_ignore_entry = "\n# Claude Code — local tool, never commit\n.claude/\n"
    if gitignore_path.exists():
        existing = gitignore_path.read_text(encoding="utf-8")
        if ".claude/" not in existing:
            with open(gitignore_path, "a", encoding="utf-8") as f:
                f.write(claude_ignore_entry)
            print("  Added .claude/ to existing .gitignore")
        else:
            print("  .claude/ already in .gitignore, skipping")
    else:
        gitignore_path.write_text(claude_ignore_entry, encoding="utf-8")
        print("  Created .gitignore with .claude/ exclusion")

    print("[5c/5] Writing .claude/settings.json (hook registration)...")
    deploy_settings(target)
    print("  hooks: SessionStart, UserPromptSubmit, PostToolUse, Stop")

    ci_profile = getattr(args, "ci_profile", "")
    deploy_target = getattr(args, "deploy_target", "none")
    if ci_profile:
        print(f"[6/6] Setting up CI/CD (profile: {ci_profile})...")
        deploy_ci(target, ci_profile, deploy_target)
    else:
        print("[6/6] Skipping CI/CD (no --ci-profile specified)")

    if args.with_tests:
        print("[+] Copying test suite...")
        shutil.copytree(INFRA_DIR / "tests" / "hook", target / "tests" / "hook", dirs_exist_ok=True)
        shutil.copytree(INFRA_DIR / "tests" / "fixtures", target / "tests" / "fixtures", dirs_exist_ok=True)
        shutil.copytree(INFRA_DIR / "tests" / "infra", target / "tests" / "infra", dirs_exist_ok=True)
        shutil.copy2(INFRA_DIR / "package.json", target / "package.json")

    print("[7/7] Registering deploy...")
    _register_deploy(target, selected, ci_profile, getattr(args, "deploy_target", "none"))

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

    if "--status" in sys.argv:
        status_cmd()
        return

    if "--update-all" in sys.argv:
        update_all_cmd()
        return

    if "--update" in sys.argv:
        idx = sys.argv.index("--update")
        if idx + 1 >= len(sys.argv):
            print("ERROR: --update requires a target path", file=sys.stderr)
            sys.exit(1)
        update_cmd(sys.argv[idx + 1])
        return

    parser = argparse.ArgumentParser(
        description="Deploy claude-scaffold into a target project.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\n".join([
            "Examples:",
            "  python scripts/deploy.py ~/Repos/my-project --all",
            "  python scripts/deploy.py ~/Repos/my-project --all --include-meta --with-tests",
            "  python scripts/deploy.py ~/Repos/my-project --skills python-project-standards,fastapi-patterns",
            "  python scripts/deploy.py ~/Repos/my-project --all --ci-profile fastapi",
            "  python scripts/deploy.py ~/Repos/my-project --all --ci-profile fastapi-db --deploy-target yc",
            "  python scripts/deploy.py ~/Repos/my-project --all --ci-profile ml-heavy --deploy-target vps",
            "",
            "Update commands:",
            "  python scripts/deploy.py --status              # show all repos + version drift",
            "  python scripts/deploy.py --update <path>       # update .claude/ in one repo",
            "  python scripts/deploy.py --update-all          # update .claude/ in all registered repos",
        ]),
    )
    parser.add_argument("target", help="Target project directory")
    parser.add_argument("--all", action="store_true", help="Include all non-meta skills")
    parser.add_argument("--skills", default="", help="Comma-separated skill list")
    parser.add_argument("--include-meta", action="store_true", dest="include_meta",
                        help="Include meta-skills (design-doc-creator, skill-developer)")
    parser.add_argument("--with-tests", action="store_true", dest="with_tests",
                        help="Copy test suite into target project")
    parser.add_argument(
        "--ci-profile",
        dest="ci_profile",
        default="",
        choices=["minimal", "fastapi", "fastapi-db", "ml-heavy"],
        help="CI/CD profile to deploy into .github/workflows/ci.yml",
    )
    parser.add_argument(
        "--deploy-target",
        dest="deploy_target",
        default="none",
        choices=["none", "yc", "vps"],
        help="Deploy stage: yc (Yandex Cloud), vps (SSH+docker-compose), none (default)",
    )

    args = parser.parse_args()

    if not args.all and not args.skills:
        parser.error("Specify --all or --skills <list>")

    deploy(args)


if __name__ == "__main__":
    main()
