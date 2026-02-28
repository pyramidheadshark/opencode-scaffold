function loadSkillRules(fs, rulesPath) {
  if (!fs.existsSync(rulesPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  } catch {
    return null;
  }
}

function loadStatusContent(fs, path, cwd, statusFile) {
  const statusPath = path.join(cwd, statusFile);
  if (!fs.existsSync(statusPath)) return null;
  return fs.readFileSync(statusPath, "utf8");
}

function matchSkills(rules, prompt, changedFiles, maxSkills) {
  const promptLower = prompt.toLowerCase();
  const matched = [];

  for (const rule of rules) {
    if (matched.length >= maxSkills) break;
    if (rule.optional) continue;

    const triggers = rule.triggers || {};
    let hit = false;

    if (triggers.always_load) {
      hit = true;
    }

    if (!hit && triggers.keywords) {
      const minMatches = triggers.min_keyword_matches || 1;
      const matchCount = triggers.keywords.filter((kw) =>
        promptLower.includes(kw.toLowerCase())
      ).length;
      if (matchCount >= minMatches) hit = true;
    }

    if (!hit && triggers.files && changedFiles.length > 0) {
      hit = triggers.files.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."));
        return changedFiles.some((f) => regex.test(f));
      });
    }

    if (hit) matched.push(rule.skill);
  }

  return matched;
}

function loadSkillContent(fs, path, cwd, skillName, compressionThreshold) {
  const skillPath = path.join(cwd, `.claude/skills/${skillName}/SKILL.md`);
  if (!fs.existsSync(skillPath)) return null;

  const content = fs.readFileSync(skillPath, "utf8");
  const lines = content.split("\n");

  if (lines.length > compressionThreshold) {
    const headers = lines
      .filter((l) => l.startsWith("#"))
      .slice(0, 10)
      .join("\n");
    const firstSection = lines.slice(0, 50).join("\n");
    return {
      compressed: true,
      lineCount: lines.length,
      output: `## Skill: ${skillName} (compressed — ${lines.length} lines)\n\n${firstSection}\n\n[Sections available: ${headers}]\n\nTo load a specific section, ask explicitly.`,
    };
  }

  return {
    compressed: false,
    lineCount: lines.length,
    output: `## Skill: ${skillName}\n\n${content}`,
  };
}

function buildInjections(fs, path, cwd, prompt, changedFiles, rules) {
  const contextMgmt = rules.context_management || {};
  const maxSkills = contextMgmt.max_skills_per_session || 3;
  const statusFile = contextMgmt.status_file || "dev/status.md";
  const compressionThreshold = contextMgmt.compression_threshold_lines || 300;

  const injections = [];

  const statusContent = loadStatusContent(fs, path, cwd, statusFile);
  if (statusContent) {
    injections.push(`## Project Status\n\n${statusContent}`);
  }

  const matchedSkills = matchSkills(rules.rules || [], prompt, changedFiles, maxSkills);

  for (const skillName of matchedSkills) {
    const result = loadSkillContent(fs, path, cwd, skillName, compressionThreshold);
    if (result) injections.push(result.output);
  }

  return { injections, matchedSkills };
}

function buildOutput(injections) {
  if (injections.length === 0) {
    return { continue: true };
  }
  return {
    continue: true,
    system_prompt_addition: injections.join("\n\n---\n\n"),
  };
}

module.exports = {
  loadSkillRules,
  loadStatusContent,
  matchSkills,
  loadSkillContent,
  buildInjections,
  buildOutput,
};
