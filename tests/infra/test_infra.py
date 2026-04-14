import json
import re
import ast
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

INFRA_ROOT = Path(__file__).parent.parent.parent
SKILLS_DIR = INFRA_ROOT / ".claude" / "skills"
AGENTS_DIR = INFRA_ROOT / ".claude" / "agents"
COMMANDS_DIR = INFRA_ROOT / ".claude" / "commands"
HOOKS_DIR = INFRA_ROOT / ".claude" / "hooks"
TEMPLATES_DIR = INFRA_ROOT / "templates"
SKILL_RULES_PATH = SKILLS_DIR / "skill-rules.json"


def load_skill_rules() -> dict:
    with open(SKILL_RULES_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_all_skill_dirs() -> list[Path]:
    return [d for d in SKILLS_DIR.iterdir() if d.is_dir() and not d.name.startswith("{")]


def extract_python_blocks(md_content: str) -> list[str]:
    pattern = r"```python\n(.*?)```"
    return re.findall(pattern, md_content, re.DOTALL)


class TestSkillRulesJson(unittest.TestCase):
    def setUp(self):
        self.rules = load_skill_rules()

    def test_skill_rules_is_valid_json(self):
        self.assertIsInstance(self.rules, dict)

    def test_has_rules_array(self):
        self.assertIn("rules", self.rules)
        self.assertIsInstance(self.rules["rules"], list)

    def test_has_context_management(self):
        self.assertIn("context_management", self.rules)
        cm = self.rules["context_management"]
        self.assertIn("max_skills_per_session", cm)
        self.assertIn("compression_threshold_lines", cm)
        self.assertIn("status_file", cm)

    def test_each_rule_has_required_fields(self):
        for rule in self.rules["rules"]:
            with self.subTest(skill=rule.get("skill", "UNKNOWN")):
                self.assertIn("skill", rule, "Rule missing 'skill' field")
                self.assertIn("triggers", rule, "Rule missing 'triggers' field")
                self.assertIn("priority", rule, "Rule missing 'priority' field")

    def test_priorities_are_unique(self):
        priorities = [r["priority"] for r in self.rules["rules"]]
        self.assertEqual(len(priorities), len(set(priorities)), "Duplicate priorities found")

    def test_all_registered_skills_have_skill_md(self):
        for rule in self.rules["rules"]:
            skill_name = rule["skill"]
            skill_md = SKILLS_DIR / skill_name / "SKILL.md"
            with self.subTest(skill=skill_name):
                self.assertTrue(
                    skill_md.exists(),
                    f"Registered skill '{skill_name}' has no SKILL.md at {skill_md}"
                )

    def test_all_skill_dirs_are_registered(self):
        registered = {r["skill"] for r in self.rules["rules"]}
        for skill_dir in get_all_skill_dirs():
            with self.subTest(skill=skill_dir.name):
                self.assertIn(
                    skill_dir.name, registered,
                    f"Skill directory '{skill_dir.name}' exists but is not in skill-rules.json"
                )


class TestSkillMdFiles(unittest.TestCase):
    def test_every_skill_has_skill_md(self):
        for skill_dir in get_all_skill_dirs():
            with self.subTest(skill=skill_dir.name):
                self.assertTrue(
                    (skill_dir / "SKILL.md").exists(),
                    f"No SKILL.md in {skill_dir}"
                )

    def test_every_skill_md_has_when_to_load_section(self):
        for skill_dir in get_all_skill_dirs():
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            content = skill_md.read_text(encoding="utf-8")
            with self.subTest(skill=skill_dir.name):
                self.assertIn(
                    "When to Load", content,
                    f"{skill_dir.name}/SKILL.md missing 'When to Load' section"
                )

    def test_skill_md_files_reference_existing_resources(self):
        for skill_dir in get_all_skill_dirs():
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            content = skill_md.read_text(encoding="utf-8")
            refs = re.findall(r"`resources/([^`]+)`", content)
            for ref in refs:
                resource_path = skill_dir / "resources" / ref
                with self.subTest(skill=skill_dir.name, resource=ref):
                    self.assertTrue(
                        resource_path.exists(),
                        f"{skill_dir.name}/SKILL.md references missing resource: resources/{ref}"
                    )

    def test_python_blocks_in_skills_are_syntactically_valid(self):
        errors = []
        for skill_dir in get_all_skill_dirs():
            for md_file in skill_dir.rglob("*.md"):
                content = md_file.read_text(encoding="utf-8")
                blocks = extract_python_blocks(content)
                for i, block in enumerate(blocks):
                    try:
                        ast.parse(block)
                    except SyntaxError as e:
                        errors.append(f"{md_file.relative_to(INFRA_ROOT)} block #{i+1}: {e}")

        self.assertEqual(errors, [], "Syntax errors found in Python code blocks:\n" + "\n".join(errors))

    def test_skill_md_files_not_excessively_large(self):
        HARD_LIMIT = 600
        for skill_dir in get_all_skill_dirs():
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            lines = skill_md.read_text(encoding="utf-8").splitlines()
            with self.subTest(skill=skill_dir.name):
                self.assertLessEqual(
                    len(lines), HARD_LIMIT,
                    f"{skill_dir.name}/SKILL.md has {len(lines)} lines (limit: {HARD_LIMIT}). Extract to resources/."
                )

    def test_skill_line_budget(self):
        SOFT_LIMIT = 300
        for skill_dir in get_all_skill_dirs():
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            lines = skill_md.read_text(encoding="utf-8").splitlines()
            with self.subTest(skill=skill_dir.name):
                self.assertLessEqual(
                    len(lines), SOFT_LIMIT,
                    f"{skill_dir.name}: {len(lines)} lines (limit: {SOFT_LIMIT})"
                )


class TestAgentFiles(unittest.TestCase):
    REQUIRED_SECTIONS = ["Purpose", "When to Use", "Instructions for Claude Code"]

    def test_all_agents_have_required_sections(self):
        for agent_file in AGENTS_DIR.glob("*.md"):
            content = agent_file.read_text(encoding="utf-8")
            for section in self.REQUIRED_SECTIONS:
                with self.subTest(agent=agent_file.name, section=section):
                    self.assertIn(
                        section, content,
                        f"{agent_file.name} missing section: '{section}'"
                    )

    def test_agents_have_output_format_or_workflow(self):
        for agent_file in AGENTS_DIR.glob("*.md"):
            content = agent_file.read_text(encoding="utf-8")
            has_output = "Output Format" in content or "Workflow" in content or "Output" in content
            with self.subTest(agent=agent_file.name):
                self.assertTrue(
                    has_output,
                    f"{agent_file.name} has no 'Output Format' or 'Workflow' section"
                )


class TestCommandFiles(unittest.TestCase):
    def test_all_commands_have_instructions_section(self):
        for cmd_file in COMMANDS_DIR.glob("*.md"):
            content = cmd_file.read_text(encoding="utf-8")
            with self.subTest(command=cmd_file.name):
                self.assertIn(
                    "Instructions for Claude Code", content,
                    f"{cmd_file.name} missing 'Instructions for Claude Code' section"
                )


class TestTemplateFiles(unittest.TestCase):
    REQUIRED_TEMPLATES = [
        "design-doc.md",
        "status.md",
        "Dockerfile",
        "docker-compose.yml",
        "pyproject.toml",
        ".env.example",
        "Makefile",
        "github/workflows/lint.yml",
        "github/workflows/test.yml",
        "github/workflows/build.yml",
    ]

    def test_all_required_templates_exist(self):
        for template in self.REQUIRED_TEMPLATES:
            with self.subTest(template=template):
                self.assertTrue(
                    (TEMPLATES_DIR / template).exists(),
                    f"Required template missing: templates/{template}"
                )

    def test_dockerfile_has_multi_stage_build(self):
        content = (TEMPLATES_DIR / "Dockerfile").read_text(encoding="utf-8")
        from_count = content.count("FROM ")
        self.assertGreater(from_count, 1, "Dockerfile should be multi-stage (multiple FROM)")

    def test_pyproject_toml_has_required_sections(self):
        content = (TEMPLATES_DIR / "pyproject.toml").read_text(encoding="utf-8")
        for section in ["[project]", "[tool.ruff]", "[tool.mypy]", "[tool.pytest.ini_options]"]:
            with self.subTest(section=section):
                self.assertIn(section, content)

    def test_env_example_has_no_real_secrets(self):
        content = (TEMPLATES_DIR / ".env.example").read_text(encoding="utf-8")
        suspicious = re.findall(r"=\s*(?!\.\.\.)[a-zA-Z0-9+/]{20,}", content)
        self.assertEqual(
            suspicious, [],
            f"Possible real secrets in .env.example: {suspicious}"
        )

    def test_makefile_has_essential_targets(self):
        content = (TEMPLATES_DIR / "Makefile").read_text(encoding="utf-8")
        for target in ["install", "lint", "test", "docker-up", "docker-down"]:
            with self.subTest(target=target):
                self.assertIn(f"{target}:", content, f"Makefile missing target: {target}")


class TestHookFiles(unittest.TestCase):
    def test_skill_activation_prompt_is_valid_js(self):
        hook_file = HOOKS_DIR / "skill-activation-prompt.js"
        self.assertTrue(hook_file.exists())
        content = hook_file.read_text(encoding="utf-8")
        self.assertIn("require(", content)
        self.assertIn("process.stdout.write", content)

    def test_skill_activation_logic_exports_all_functions(self):
        logic_file = HOOKS_DIR / "skill-activation-logic.js"
        self.assertTrue(logic_file.exists(), "skill-activation-logic.js missing")
        content = logic_file.read_text(encoding="utf-8")
        for fn in ["loadSkillRules", "matchSkills", "loadSkillContent", "buildInjections", "buildOutput"]:
            with self.subTest(fn=fn):
                self.assertIn(fn, content, f"skill-activation-logic.js missing export: {fn}")

    def test_quality_check_hook_exists(self):
        hook_file = HOOKS_DIR / "python-quality-check.js"
        self.assertTrue(hook_file.exists(), "python-quality-check.js not found in hooks/")
        content = hook_file.read_text(encoding="utf-8")
        self.assertTrue(len(content) > 0, "python-quality-check.js is empty")

    def test_session_checkpoint_hook_exists(self):
        hook_file = HOOKS_DIR / "session-checkpoint.js"
        self.assertTrue(hook_file.exists(), "session-checkpoint.js missing")
        content = hook_file.read_text(encoding="utf-8")
        self.assertIn("ExitPlanMode", content)
        self.assertIn("hookSpecificOutput", content)


class TestClaudeIgnore(unittest.TestCase):
    def test_claudeignore_exists(self):
        claudeignore = INFRA_ROOT / ".claudeignore"
        self.assertTrue(
            claudeignore.exists(),
            ".claudeignore missing — add it to reduce context noise"
        )

    def test_claudeignore_excludes_node_modules(self):
        content = (INFRA_ROOT / ".claudeignore").read_text(encoding="utf-8")
        self.assertIn("node_modules/", content)

    def test_claudeignore_excludes_jsonl(self):
        content = (INFRA_ROOT / ".claudeignore").read_text(encoding="utf-8")
        self.assertIn("*.jsonl", content)


class TestCLAUDEmd(unittest.TestCase):
    def setUp(self):
        self.content = (INFRA_ROOT / ".claude" / "CLAUDE.md").read_text(encoding="utf-8")

    def test_has_skill_inventory_table(self):
        self.assertIn("Skill Inventory", self.content)

    def test_has_agent_inventory_table(self):
        self.assertIn("Agent Inventory", self.content)

    def test_has_model_routing_section(self):
        self.assertIn("Model Routing", self.content)

    def test_all_registered_skills_mentioned_in_claude_md(self):
        rules = load_skill_rules()
        for rule in rules["rules"]:
            skill_name = rule["skill"]
            with self.subTest(skill=skill_name):
                self.assertIn(
                    skill_name, self.content,
                    f"Skill '{skill_name}' in skill-rules.json but not mentioned in CLAUDE.md"
                )


class TestSkillMetadata(unittest.TestCase):
    def test_every_skill_has_metadata_file(self):
        for skill_dir in get_all_skill_dirs():
            with self.subTest(skill=skill_dir.name):
                self.assertTrue(
                    (skill_dir / "skill-metadata.json").exists(),
                    f"Skill '{skill_dir.name}' is missing skill-metadata.json"
                )

    def test_metadata_has_required_fields(self):
        for skill_dir in get_all_skill_dirs():
            metadata_path = skill_dir / "skill-metadata.json"
            if not metadata_path.exists():
                continue
            with self.subTest(skill=skill_dir.name):
                data = json.loads(metadata_path.read_text(encoding="utf-8"))
                self.assertIn("version", data, f"{skill_dir.name}/skill-metadata.json missing 'version'")
                self.assertIn("updated", data, f"{skill_dir.name}/skill-metadata.json missing 'updated'")
                self.assertIn("size_lines", data, f"{skill_dir.name}/skill-metadata.json missing 'size_lines'")

    def test_metadata_size_lines_is_accurate(self):
        tolerance = 10
        for skill_dir in get_all_skill_dirs():
            metadata_path = skill_dir / "skill-metadata.json"
            skill_md = skill_dir / "SKILL.md"
            if not metadata_path.exists() or not skill_md.exists():
                continue
            data = json.loads(metadata_path.read_text(encoding="utf-8"))
            actual_lines = len(skill_md.read_text(encoding="utf-8").splitlines())
            declared_lines = data.get("size_lines", 0)
            with self.subTest(skill=skill_dir.name):
                self.assertAlmostEqual(
                    actual_lines, declared_lines, delta=tolerance,
                    msg=f"{skill_dir.name}/skill-metadata.json size_lines={declared_lines} but SKILL.md has {actual_lines} lines"
                )

    def test_min_keyword_matches_is_valid_if_present(self):
        rules = load_skill_rules()
        for rule in rules["rules"]:
            triggers = rule.get("triggers", {})
            if "min_keyword_matches" in triggers:
                with self.subTest(skill=rule["skill"]):
                    value = triggers["min_keyword_matches"]
                    self.assertIsInstance(value, int, f"{rule['skill']}: min_keyword_matches must be int")
                    self.assertGreaterEqual(value, 2, f"{rule['skill']}: min_keyword_matches should be >= 2")


class TestDeployScript(unittest.TestCase):
    def _run_deploy_settings(self, target: Path) -> None:
        scripts_dir = INFRA_ROOT / "scripts"
        sys.path.insert(0, str(scripts_dir))
        try:
            import importlib
            deploy_mod = importlib.import_module("deploy")
            deploy_mod.deploy_settings(target)
        finally:
            sys.path.pop(0)

    def test_deploy_creates_settings_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            target = Path(tmpdir)
            (target / ".claude").mkdir()
            self._run_deploy_settings(target)
            settings_path = target / ".claude" / "settings.json"
            self.assertTrue(settings_path.exists(), "settings.json was not created")
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertIn("hooks", data, "settings.json missing 'hooks' key")
            self.assertIn("UserPromptSubmit", data["hooks"], "hooks missing UserPromptSubmit")
            self.assertIn("PreToolUse", data["hooks"], "hooks missing PreToolUse (bash-output-filter + session-safety)")

    def test_deploy_post_tool_use_has_two_hooks(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            result = __import__("subprocess").run(
                ["node", "-e",
                 f"require('./lib/deploy/copy').deploySettings('{tmp.replace(chr(92), '/')}')"],
                cwd=str(INFRA_ROOT), capture_output=True, text=True
            )
            self.assertEqual(result.returncode, 0, f"deploySettings failed: {result.stderr}")
            settings_path = tmp_path / ".claude" / "settings.json"
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            hooks = data["hooks"]["PostToolUse"][0]["hooks"]
            self.assertEqual(len(hooks), 2)
            self.assertIn("post-tool-use-tracker.js", hooks[0]["command"])
            self.assertIn("session-checkpoint.js", hooks[1]["command"])

    def test_deploy_settings_preserves_mcp_servers(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            target = Path(tmpdir)
            (target / ".claude").mkdir()
            settings_path = target / ".claude" / "settings.json"
            settings_path.write_text(
                json.dumps({"mcpServers": {"my-server": {"command": "npx", "args": ["-y", "my-mcp"]}}}),
                encoding="utf-8",
            )
            self._run_deploy_settings(target)
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertIn("mcpServers", data, "mcpServers was removed after deploy_settings")
            self.assertIn("hooks", data, "hooks missing after merge")


PROFILES_DIR = TEMPLATES_DIR / "profiles"

EXPECTED_PROFILES = {
    "ml-engineer": ["python-project-standards", "ml-data-handling", "predictive-analytics",
                    "rag-vector-db", "langgraph-patterns", "test-first-patterns"],
    "ai-developer": ["python-project-standards", "fastapi-patterns", "multimodal-router",
                     "langgraph-patterns", "github-actions", "test-first-patterns"],
    "fastapi-developer": ["python-project-standards", "fastapi-patterns", "htmx-frontend",
                          "test-first-patterns", "github-actions"],
    "fullstack": ["python-project-standards", "fastapi-patterns", "htmx-frontend",
                  "ml-data-handling", "test-first-patterns", "github-actions"],
}


class TestProfileTemplates(unittest.TestCase):
    def test_all_profile_dirs_exist(self):
        for profile in EXPECTED_PROFILES:
            with self.subTest(profile=profile):
                self.assertTrue(
                    (PROFILES_DIR / profile).is_dir(),
                    f"Profile directory missing: templates/profiles/{profile}/"
                )

    def test_all_profiles_have_en_template(self):
        for profile in EXPECTED_PROFILES:
            with self.subTest(profile=profile):
                template_path = PROFILES_DIR / profile / "CLAUDE.md.en"
                self.assertTrue(
                    template_path.exists(),
                    f"Missing: templates/profiles/{profile}/CLAUDE.md.en"
                )

    def test_all_profiles_have_ru_template(self):
        for profile in EXPECTED_PROFILES:
            with self.subTest(profile=profile):
                template_path = PROFILES_DIR / profile / "CLAUDE.md.ru"
                self.assertTrue(
                    template_path.exists(),
                    f"Missing: templates/profiles/{profile}/CLAUDE.md.ru"
                )

    def test_profile_templates_are_valid_utf8(self):
        for profile in EXPECTED_PROFILES:
            for lang in ("en", "ru"):
                template_path = PROFILES_DIR / profile / f"CLAUDE.md.{lang}"
                if not template_path.exists():
                    continue
                with self.subTest(profile=profile, lang=lang):
                    try:
                        content = template_path.read_text(encoding="utf-8")
                        self.assertGreater(len(content), 100, f"Template too short: {template_path}")
                    except UnicodeDecodeError as e:
                        self.fail(f"UTF-8 decode error in {template_path}: {e}")

    def test_profile_skills_exist_in_skills_dir(self):
        for profile, skills in EXPECTED_PROFILES.items():
            for skill in skills:
                with self.subTest(profile=profile, skill=skill):
                    self.assertTrue(
                        (SKILLS_DIR / skill).is_dir(),
                        f"Profile '{profile}' requires skill '{skill}' which doesn't exist in .claude/skills/"
                    )

    def test_profiles_js_matches_expected_profiles(self):
        profiles_js = INFRA_ROOT / "lib" / "profiles.js"
        self.assertTrue(profiles_js.exists(), "lib/profiles.js not found")
        content = profiles_js.read_text(encoding="utf-8")
        for profile in EXPECTED_PROFILES:
            self.assertIn(profile, content,
                          f"Profile '{profile}' not found in lib/profiles.js")


ORG_PROFILES_DIR = INFRA_ROOT / "org-profiles"


class TestOrgProfilesStructure(unittest.TestCase):
    def test_org_profiles_directory_exists(self):
        self.assertTrue(
            ORG_PROFILES_DIR.is_dir(),
            "org-profiles/ directory missing from scaffold root"
        )

    def test_org_profile_module_exists(self):
        module_path = INFRA_ROOT / "lib" / "commands" / "org-profile.js"
        self.assertTrue(
            module_path.exists(),
            "lib/commands/org-profile.js not found"
        )

    def test_org_profile_module_exports_expected_functions(self):
        module_path = INFRA_ROOT / "lib" / "commands" / "org-profile.js"
        content = module_path.read_text(encoding="utf-8")
        for func in ["loadOrgProfile", "deployOrgTemplate", "writeScaffoldMeta",
                     "listOrgProfiles", "updateOrgProfile"]:
            self.assertIn(func, content, f"Function '{func}' not found in org-profile.js")


class TestRegistryHealth(unittest.TestCase):
    REGISTRY_PATH = INFRA_ROOT / "deployed-repos.json"
    TEMP_PATTERNS = ["cs-test-", "AppData\\Local\\Temp", "/tmp/cs-test"]

    def test_registry_has_no_stale_temp_entries(self):
        if not self.REGISTRY_PATH.exists():
            self.skipTest("deployed-repos.json not found (gitignored, may not exist)")
        registry = json.loads(self.REGISTRY_PATH.read_text(encoding="utf-8"))
        stale = [
            e["path"] for e in registry.get("deployed", [])
            if any(pat in e.get("path", "") for pat in self.TEMP_PATTERNS)
        ]
        self.assertEqual(
            stale, [],
            f"deployed-repos.json contains {len(stale)} stale temp entries: {stale[:3]}..."
        )


class TestCriticalAnalysisSkill(unittest.TestCase):
    SKILL_DIR = SKILLS_DIR / "critical-analysis"
    SKILL_MD = SKILL_DIR / "SKILL.md"
    METADATA = SKILL_DIR / "skill-metadata.json"
    RESOURCES = SKILL_DIR / "resources"

    def test_critical_analysis_skill_exists(self):
        self.assertTrue(self.SKILL_DIR.exists(), "critical-analysis skill directory missing")
        self.assertTrue(self.SKILL_MD.exists(), "critical-analysis SKILL.md missing")

    def test_critical_analysis_in_skill_rules(self):
        rules = load_skill_rules()
        names = [r["skill"] for r in rules["rules"]]
        self.assertIn("critical-analysis", names, "critical-analysis not in skill-rules.json")
        entry = next(r for r in rules["rules"] if r["skill"] == "critical-analysis")
        self.assertGreaterEqual(
            entry.get("priority", -1), 0, "critical-analysis priority must be >= 0 (0 = highest)"
        )
        triggers = entry.get("triggers", {})
        self.assertGreater(
            len(triggers.get("keywords", [])), 10,
            "critical-analysis needs at least 10 keywords for good coverage"
        )

    def test_critical_analysis_metadata_valid(self):
        self.assertTrue(self.METADATA.exists(), "skill-metadata.json missing")
        meta = json.loads(self.METADATA.read_text(encoding="utf-8"))
        self.assertIn("version", meta)
        self.assertIn("size_lines", meta)
        self.assertGreater(meta["size_lines"], 0, "size_lines must be > 0")
        self.assertIn("resources", meta)
        self.assertIsInstance(meta["resources"], list)
        self.assertGreater(len(meta["resources"]), 0, "at least one resource must be listed")

    def test_critical_analysis_under_budget(self):
        content = self.SKILL_MD.read_text(encoding="utf-8")
        line_count = len(content.splitlines())
        self.assertLessEqual(
            line_count, 300,
            f"SKILL.md has {line_count} lines, exceeds 300-line budget"
        )

    def test_critical_analysis_resources_exist(self):
        self.assertTrue(self.RESOURCES.exists(), "resources/ directory missing")
        for res_name in ["role-prompts.md", "ml-audit-protocol.md", "failure-patterns.md"]:
            res_path = self.RESOURCES / res_name
            self.assertTrue(res_path.exists(), f"Resource file missing: {res_name}")
            content = res_path.read_text(encoding="utf-8")
            self.assertGreater(len(content), 100, f"{res_name} appears empty")

    def test_critical_analysis_keyword_count(self):
        rules = load_skill_rules()
        entry = next(r for r in rules["rules"] if r["skill"] == "critical-analysis")
        keywords = entry.get("triggers", {}).get("keywords", [])
        self.assertGreaterEqual(
            len(keywords), 30,
            f"critical-analysis has only {len(keywords)} keywords, need >= 30 for good coverage"
        )

    def test_critical_analysis_skill_md_has_8_roles(self):
        content = self.SKILL_MD.read_text(encoding="utf-8")
        roles = re.findall(r"\|\s*\*\*\[", content)
        self.assertEqual(
            len(roles), 8,
            f"SKILL.md should have exactly 8 role rows in table, found {len(roles)}"
        )

    def test_critical_analysis_trigger_simulation(self):
        import subprocess
        import tempfile
        import shutil

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            claude_skills = tmp_path / ".claude" / "skills"
            claude_skills.mkdir(parents=True)
            skill_rules_src = SKILLS_DIR / "skill-rules.json"
            shutil.copy(skill_rules_src, claude_skills / "skill-rules.json")
            shutil.copytree(
                SKILLS_DIR / "critical-analysis",
                claude_skills / "critical-analysis",
            )
            shutil.copytree(
                SKILLS_DIR / "python-project-standards",
                claude_skills / "python-project-standards",
            )
            subprocess.run(["git", "init"], cwd=tmp, capture_output=True)

            result = subprocess.run(
                ["node", str(HOOKS_DIR / "skill-activation-prompt.js")],
                input='{"prompt":"проверим подход и качество параметров"}',
                capture_output=True,
                encoding="utf-8",
                timeout=15,
                cwd=tmp,
            )
        self.assertIn(
            "critical-analysis",
            result.stdout,
            "skill-activation-prompt.js did not inject critical-analysis for prompt with 2+ keywords"
        )


class TestAgentFrontmatter(unittest.TestCase):
    def test_all_agents_have_model_frontmatter(self):
        agent_files = list(AGENTS_DIR.glob("*.md"))
        self.assertGreater(len(agent_files), 0, "No agent files found in .claude/agents/")
        for agent_file in agent_files:
            content = agent_file.read_text(encoding="utf-8")
            lines = content.splitlines()
            first_10 = "\n".join(lines[:10])
            self.assertIn(
                "model:",
                first_10,
                f"{agent_file.name} is missing 'model:' in frontmatter (first 10 lines)"
            )

    def test_agent_model_values_are_known(self):
        known_models = {
            "claude-haiku-4-5-20251001",
            "claude-sonnet-4-6",
            "claude-opus-4-6",
        }
        agent_files = list(AGENTS_DIR.glob("*.md"))
        for agent_file in agent_files:
            content = agent_file.read_text(encoding="utf-8")
            lines = content.splitlines()
            model_line = next(
                (l for l in lines[:10] if l.startswith("model:")), None
            )
            if model_line is None:
                continue
            model_value = model_line.split(":", 1)[1].strip()
            self.assertIn(
                model_value,
                known_models,
                f"{agent_file.name} has unknown model value: '{model_value}'"
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
