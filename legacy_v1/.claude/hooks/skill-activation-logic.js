function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

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

function getSkillSize(skillName, skillsDir, fsModule) {
  if (!skillsDir || !fsModule) return 300;
  try {
    const p = require("path");
    const metaPath = p.join(skillsDir, skillName, "skill-metadata.json");
    if (!fsModule.existsSync(metaPath)) return 300;
    const meta = JSON.parse(fsModule.readFileSync(metaPath, "utf8"));
    return meta.size_lines || 300;
  } catch {
    return 300;
  }
}

function matchSkills(rules, prompt, changedFiles, maxSkills, alreadyLoaded = [], options = {}) {
  const promptLower = prompt.toLowerCase();
  const matched = [];
  const { budgetLines, skillsDir, fsModule, platform } = options;
  const currentPlatform = platform || process.platform;
  const useBudget = typeof budgetLines === "number" && budgetLines > 0;
  let usedLines = 0;

  const sortedRules = [...rules].sort((a, b) => {
    const aAlways = a.triggers && a.triggers.always_load ? 0 : 1;
    const bAlways = b.triggers && b.triggers.always_load ? 0 : 1;
    if (aAlways !== bAlways) return aAlways - bAlways;
    return (a.priority != null ? a.priority : 99) - (b.priority != null ? b.priority : 99);
  });

  for (const rule of sortedRules) {
    if (!useBudget && matched.length >= maxSkills) break;
    if (rule.optional) continue;
    if (alreadyLoaded.includes(rule.skill)) continue;

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

    if (!hit && triggers.platform_trigger) {
      if (currentPlatform === triggers.platform_trigger) hit = true;
    }

    if (hit) {
      if (useBudget) {
        const size = getSkillSize(rule.skill, skillsDir, fsModule);
        if (triggers.always_load) {
          matched.push(rule.skill);
          usedLines += size;
        } else if (usedLines + size <= budgetLines) {
          matched.push(rule.skill);
          usedLines += size;
        }
      } else {
        matched.push(rule.skill);
      }
    }
  }

  return useBudget ? { skills: matched, usedLines } : matched;
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

function buildInjections(fs, path, cwd, prompt, changedFiles, rules, sessionContext = {}) {
  const contextMgmt = rules.context_management || {};
  const maxSkills = contextMgmt.max_skills_per_session || 3;
  const budgetLines = contextMgmt.budget_lines || null;
  const statusFile = contextMgmt.status_file || "dev/status.md";
  const compressionThreshold = contextMgmt.compression_threshold_lines || 300;
  const skillsDir = path.join(cwd, ".claude/skills");

  const { alreadyLoadedSkills = [], lastStatusHash = null } = sessionContext;

  const injections = [];

  const statusContent = loadStatusContent(fs, path, cwd, statusFile);
  const statusHash = statusContent ? simpleHash(statusContent) : null;
  const statusChanged = statusHash !== lastStatusHash;
  if (statusContent && statusChanged) {
    injections.push(`## Project Status\n\n${statusContent}`);
  }

  const matchResult = matchSkills(
    rules.rules || [], prompt, changedFiles, maxSkills, alreadyLoadedSkills,
    budgetLines ? { budgetLines, skillsDir, fsModule: fs } : {}
  );
  const matchedSkills = Array.isArray(matchResult) ? matchResult : matchResult.skills;

  for (const skillName of matchedSkills) {
    const result = loadSkillContent(fs, path, cwd, skillName, compressionThreshold);
    if (result) injections.push(result.output);
  }

  return { injections, matchedSkills, statusHash };
}

function extractRelevantPitfalls(pitfallsContent, changedFiles, prompt) {
  if (!pitfallsContent) return null;
  const sections = [];
  let current = null;
  for (const line of pitfallsContent.split("\n")) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { header: line.slice(3).trim(), headerLower: line.slice(3).trim().toLowerCase(), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  const promptLower = (prompt || "").toLowerCase();
  const filesLower = (changedFiles || []).map(f => f.toLowerCase());

  const matched = sections.filter(s => {
    const kw = s.headerLower;
    if (promptLower.includes(kw)) return true;
    return filesLower.some(f => f.includes(kw));
  });

  if (matched.length === 0) return null;
  return matched.map(s => s.lines.join("\n")).join("\n\n");
}

function buildOutput(injections) {
  if (injections.length === 0) {
    return { continue: true };
  }
  return {
    continue: true,
    additionalContext: injections.join("\n\n---\n\n"),
  };
}

module.exports = {
  simpleHash,
  loadSkillRules,
  loadStatusContent,
  getSkillSize,
  matchSkills,
  loadSkillContent,
  extractRelevantPitfalls,
  buildInjections,
  buildOutput,
};
