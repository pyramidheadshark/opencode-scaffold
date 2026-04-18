'use strict';

const fs = require('fs');
const {
  listRepos,
  getSkillRules,
  getSettings,
  setEffort,
  toggleThinkingSummaries,
  updateRepo,
  getBuiltinProfiles,
  getOrgProfiles,
  runCliCommand,
} = require('../config-manager');

const EFFORT_LEVELS = ['max', 'high', 'medium', 'off'];

const CLI_COMMANDS = [
  { label: 'init <path> --profile <p>', desc: 'Deploy scaffold into a project', runnable: 'form-init' },
  { label: 'update --all', desc: 'Update all registered repos', runnable: 'direct', args: ['update', '--all'] },
  { label: 'update <path>', desc: 'Update one registered repo', runnable: 'form-path', cmd: 'update' },
  { label: 'status', desc: 'Registered repos + version drift', runnable: 'direct', args: ['status'] },
  { label: 'discover', desc: 'Detect stack + find matching skills', runnable: 'direct', args: ['discover'] },
  { label: 'tune <path>', desc: 'Change effort/thinking for a repo', runnable: 'form-tune' },
  { label: 'add-skill <skill> <path>', desc: 'Add a skill to a project', runnable: 'form-add-skill' },
  { label: 'metrics', desc: 'Skill load frequency report', runnable: 'direct', args: ['metrics'] },
  { label: 'session-logs', desc: 'View session audit logs', runnable: 'direct', args: ['session-logs'] },
  { label: 'registry list', desc: 'List skills in registry cache', runnable: 'direct', args: ['registry', 'list'] },
  { label: 'registry update', desc: 'Refresh registry cache', runnable: 'direct', args: ['registry', 'update'] },
  { label: 'list-org-profiles', desc: 'List org profiles + project types', runnable: 'direct', args: ['list-org-profiles'] },
  { label: 'install-aliases', desc: 'Install shell aliases (sonnet, haiku…)', runnable: 'direct', args: ['install-aliases'] },
];

function parseEffort(settings) {
  if (!settings || !settings.env) return 'max (default)';
  return settings.env.CLAUDE_CODE_EFFORT_LEVEL || 'max (default)';
}

function parseThinkingSummaries(settings) {
  if (!settings) return 'on (default)';
  return settings.showThinkingSummaries === false ? 'off' : 'on';
}

function buildItems(infraDir) {
  const profiles = getBuiltinProfiles();
  const orgProfiles = getOrgProfiles(infraDir);
  const repos = listRepos();
  const items = [];

  items.push({ type: 'header', label: ' ── Profiles ─────────────────────────' });
  for (const [name, def] of Object.entries(profiles)) {
    items.push({ type: 'profile', id: name, def, label: `   ${name.padEnd(22)}  ${def.skills.length} skills` });
  }

  items.push({ type: 'header', label: ' ── Org Profiles ─────────────────────' });
  if (orgProfiles.length === 0) {
    items.push({ type: 'static', label: '   (none found in org-profiles/)' });
  } else {
    for (const op of orgProfiles) {
      items.push({ type: 'org-profile', id: op.org, data: op, label: `   ${op.org.padEnd(22)}  ${op.types.length} types` });
    }
  }

  items.push({ type: 'header', label: ' ── Commands ─────────────────────────' });
  for (const cmd of CLI_COMMANDS) {
    const marker = cmd.runnable === 'direct' ? '▶' : '◎';
    items.push({ type: 'command', data: cmd, label: `  ${marker} ${cmd.label}` });
  }

  items.push({ type: 'header', label: ' ── Deployed Repos ───────────────────' });
  if (repos.length === 0) {
    items.push({ type: 'static', label: '   (none — run init first)' });
  } else {
    for (const repo of repos) {
      const sha = (repo.infraSha || '').slice(0, 7);
      items.push({ type: 'repo', data: repo, label: `   ${repo.name.slice(0, 22).padEnd(22)}  ${sha}` });
    }
  }

  return items;
}

function detailForItem(item, infraDir) {
  if (!item || item.type === 'header' || item.type === 'static') return '';

  if (item.type === 'profile') {
    return [
      `  {bold}${item.id}{/bold}`,
      `  {gray-fg}${item.def.description}{/gray-fg}`,
      '',
      `  Skills (${item.def.skills.length}):`,
      ...item.def.skills.map(s => `    {green-fg}•{/green-fg} ${s}`),
      '',
      '  {gray-fg}─────────────────────────────────────{/gray-fg}',
      '  {bold}[Enter]{/bold} init a project with this profile',
    ].join('\n');
  }

  if (item.type === 'org-profile') {
    const op = item.data;
    return [
      `  {bold}${op.org}{/bold}`,
      `  {gray-fg}${op.description}{/gray-fg}`,
      '',
      `  Project types (${op.types.length}):`,
      ...op.types.map(t => `    {green-fg}•{/green-fg} ${t.name.padEnd(18)} {gray-fg}${t.description}{/gray-fg}`),
    ].join('\n');
  }

  if (item.type === 'command') {
    const cmd = item.data;
    const runnableLabel = cmd.runnable === 'direct'
      ? '{green-fg}▶ direct (no args needed){/green-fg}'
      : `{yellow-fg}◎ requires input{/yellow-fg}`;
    return [
      `  {bold}${cmd.label}{/bold}`,
      '',
      `  ${cmd.desc}`,
      '',
      `  ${runnableLabel}`,
      '',
      '  {bold}[Enter]{/bold} to execute',
    ].join('\n');
  }

  if (item.type === 'repo') {
    const repo = item.data;
    const repoExists = fs.existsSync(repo.path);
    const settings = repoExists ? getSettings(repo.path) : null;
    const rules = repoExists ? getSkillRules(repo.path) : [];
    const effort = parseEffort(settings);
    const summaries = parseThinkingSummaries(settings);

    const lines = [
      `  {bold}${repo.name}{/bold}${!repoExists ? '  {red-fg}[PATH NOT FOUND]{/red-fg}' : ''}`,
      '',
      `  Path     : ${repo.path}`,
      `  Deployed : ${repo.deployedAt || '—'}   SHA: ${repo.infraSha || '—'}`,
      `  CI       : ${repo.ciProfile || '—'}  →  ${repo.deployTarget || '—'}`,
      '',
      '  {bold}Settings:{/bold}',
      `    Effort             : {yellow-fg}${effort}{/yellow-fg}`,
      `    Thinking summaries : {yellow-fg}${summaries}{/yellow-fg}`,
      '',
      `  {bold}Skills (${repo.skills.length}):{/bold}`,
      ...repo.skills.map(s => `    {green-fg}•{/green-fg} ${s}`),
    ];

    if (rules.length > 0) {
      lines.push('', `  {bold}Skill Rules (${rules.length}):{/bold}`);
      for (const rule of rules) {
        const prio = rule.priority !== undefined ? `  {gray-fg}prio:${rule.priority}{/gray-fg}` : '';
        lines.push(`    {green-fg}•{/green-fg} ${rule.skill}${prio}`);
      }
    }

    lines.push(
      '',
      '  {gray-fg}─────────────────────────────────────{/gray-fg}',
      '  {bold}[e]{/bold} effort   {bold}[t]{/bold} summaries   {bold}[u]{/bold} update scaffold',
    );

    return lines.join('\n');
  }

  return '';
}

function showPrompt(screen, blessed, label, callback) {
  const box = blessed.prompt({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '60%',
    height: 7,
    border: { type: 'line' },
    label: ` ${label} `,
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow' } },
  });
  box.input('', '', (err, value) => {
    box.destroy();
    screen.render();
    callback(err ? null : (value || '').trim());
  });
  screen.render();
}

function showEffortPicker(screen, blessed, current, callback) {
  const picker = blessed.list({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 22,
    height: EFFORT_LEVELS.length + 4,
    border: { type: 'line' },
    label: ' Effort Level ',
    items: EFFORT_LEVELS.map(e => `  ${e === current ? '▶ ' : '  '}${e}`),
    keys: true,
    vi: true,
    style: {
      item: { fg: 'white' },
      selected: { fg: 'black', bg: 'cyan', bold: true },
      border: { fg: 'yellow' },
      label: { fg: 'yellow' },
    },
  });
  const idx = EFFORT_LEVELS.indexOf(current);
  if (idx >= 0) picker.select(idx);
  picker.key(['escape', 'q'], () => { picker.destroy(); screen.render(); callback(null); });
  picker.on('select', (item, i) => { picker.destroy(); screen.render(); callback(EFFORT_LEVELS[i]); });
  picker.focus();
  screen.render();
}

function showProfilePicker(screen, blessed, profiles, callback) {
  const names = Object.keys(profiles);
  const picker = blessed.list({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 36,
    height: Math.min(names.length + 4, 14),
    border: { type: 'line' },
    label: ' Select Profile ',
    items: names.map(n => `  ${n}`),
    keys: true,
    vi: true,
    style: {
      item: { fg: 'white' },
      selected: { fg: 'black', bg: 'cyan', bold: true },
      border: { fg: 'yellow' },
      label: { fg: 'yellow' },
    },
  });
  picker.key(['escape', 'q'], () => { picker.destroy(); screen.render(); callback(null); });
  picker.on('select', (item, i) => { picker.destroy(); screen.render(); callback(names[i]); });
  picker.focus();
  screen.render();
}

function runAndShow(infraDir, args, label, navList, detailBox, screen, setStatus) {
  setStatus(`  Running ${label}...`);
  screen.render();
  const { out, err, ok } = runCliCommand(infraDir, args);
  const raw = out || err || '(no output)';
  detailBox.setContent(raw.split('\n').map(l => `  ${l}`).join('\n'));
  detailBox.setLabel(` ${label} `);
  detailBox.scrollTo(0);
  setStatus(ok
    ? `{green-fg}✓{/green-fg}  ${label}   {gray-fg}↑↓ to scroll{/gray-fg}`
    : `{red-fg}✗{/red-fg}  ${label} failed`);
  navList.focus();
  screen.render();
}

function executeCommand(item, screen, blessed, infraDir, navList, detailBox, setStatus) {
  const cmd = item.data;

  if (cmd.runnable === 'direct') {
    runAndShow(infraDir, cmd.args, cmd.label, navList, detailBox, screen, setStatus);
    return;
  }

  if (cmd.runnable === 'form-init') {
    showPrompt(screen, blessed, 'Target path for init', (targetPath) => {
      if (!targetPath) { navList.focus(); return; }
      showProfilePicker(screen, blessed, getBuiltinProfiles(), (profileName) => {
        if (!profileName) { navList.focus(); return; }
        runAndShow(infraDir, ['init', targetPath, '--profile', profileName],
          `init ${targetPath} --profile ${profileName}`, navList, detailBox, screen, setStatus);
      });
    });
    return;
  }

  if (cmd.runnable === 'form-path') {
    showPrompt(screen, blessed, `Target path for: ${cmd.cmd}`, (targetPath) => {
      if (!targetPath) { navList.focus(); return; }
      runAndShow(infraDir, [cmd.cmd, targetPath], `${cmd.cmd} ${targetPath}`,
        navList, detailBox, screen, setStatus);
    });
    return;
  }

  if (cmd.runnable === 'form-tune') {
    showPrompt(screen, blessed, 'Target path to tune', (targetPath) => {
      if (!targetPath) { navList.focus(); return; }
      const settings = getSettings(targetPath);
      const current = parseEffort(settings).replace(' (default)', '');
      const normalised = EFFORT_LEVELS.includes(current) ? current : 'max';
      showEffortPicker(screen, blessed, normalised, (level) => {
        if (!level) { navList.focus(); return; }
        try {
          setEffort(targetPath, level);
          setStatus(`{green-fg}✓{/green-fg}  effort → ${level} for ${targetPath}`);
        } catch (e) {
          setStatus(`{red-fg}✗{/red-fg}  ${e.message}`);
        }
        navList.focus();
        screen.render();
      });
    });
    return;
  }

  if (cmd.runnable === 'form-add-skill') {
    showPrompt(screen, blessed, 'Skill name', (skillName) => {
      if (!skillName) { navList.focus(); return; }
      showPrompt(screen, blessed, 'Target path', (targetPath) => {
        if (!targetPath) { navList.focus(); return; }
        runAndShow(infraDir, ['add-skill', skillName, targetPath],
          `add-skill ${skillName}`, navList, detailBox, screen, setStatus);
      });
    });
    return;
  }
}

function createConfigPanel(screen, blessed, infraDir, setStatus) {
  const allItems = buildItems(infraDir);

  const labels = allItems.map(item => {
    if (item.type === 'header') return `{bold}{cyan-fg}${item.label}{/cyan-fg}{/bold}`;
    if (item.type === 'static') return `{gray-fg}${item.label}{/gray-fg}`;
    return item.label;
  });

  const navList = blessed.list({
    parent: screen,
    top: 1,
    left: 0,
    width: '42%',
    height: screen.height - 2,
    border: { type: 'line' },
    label: ' Config ',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      item: { fg: 'white' },
      selected: { fg: 'black', bg: 'white', bold: true },
      border: { fg: 'cyan' },
      label: { fg: 'cyan' },
    },
    items: labels,
  });

  const detailBox = blessed.box({
    parent: screen,
    top: 1,
    left: '42%',
    width: '58%',
    height: screen.height - 2,
    border: { type: 'line' },
    label: ' Detail ',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      border: { fg: 'cyan' },
      label: { fg: 'cyan' },
    },
  });

  function currentItem() {
    return allItems[navList.selected] || null;
  }

  function refreshDetail() {
    const item = currentItem();
    detailBox.setContent(detailForItem(item, infraDir) || '');
    if (item && item.id) detailBox.setLabel(` ${item.id} `);
    else if (item && item.data && item.data.label) detailBox.setLabel(` ${item.data.label.split(' ')[0]} `);
    else detailBox.setLabel(' Detail ');
    screen.render();
  }

  navList.on('select item', () => refreshDetail());
  navList.key(['up', 'down', 'k', 'j'], () => refreshDetail());

  navList.key('enter', () => {
    const item = currentItem();
    if (!item || item.type === 'header' || item.type === 'static') return;
    if (item.type === 'command') {
      executeCommand(item, screen, blessed, infraDir, navList, detailBox, setStatus);
    } else if (item.type === 'profile') {
      showPrompt(screen, blessed, `Init with profile "${item.id}"  — target path`, (targetPath) => {
        if (!targetPath) { navList.focus(); return; }
        runAndShow(infraDir, ['init', targetPath, '--profile', item.id],
          `init --profile ${item.id}`, navList, detailBox, screen, setStatus);
      });
    }
  });

  navList.key('e', () => {
    const item = currentItem();
    if (!item || item.type !== 'repo') return;
    const repo = item.data;
    const raw = parseEffort(getSettings(repo.path)).replace(' (default)', '');
    showEffortPicker(screen, blessed, EFFORT_LEVELS.includes(raw) ? raw : 'max', (level) => {
      if (!level) { navList.focus(); return; }
      try {
        setEffort(repo.path, level);
        setStatus(`{green-fg}✓{/green-fg}  effort → {bold}${level}{/bold} for ${repo.name}`);
      } catch (e) {
        setStatus(`{red-fg}✗{/red-fg}  ${e.message}`);
      }
      refreshDetail();
      navList.focus();
    });
  });

  navList.key('t', () => {
    const item = currentItem();
    if (!item || item.type !== 'repo') return;
    const repo = item.data;
    try {
      const result = toggleThinkingSummaries(repo.path);
      const val = result.showThinkingSummaries !== false ? 'on' : 'off';
      setStatus(`{green-fg}✓{/green-fg}  thinking summaries → {bold}${val}{/bold} for ${repo.name}`);
    } catch (e) {
      setStatus(`{red-fg}✗{/red-fg}  ${e.message}`);
    }
    refreshDetail();
  });

  navList.key('u', () => {
    const item = currentItem();
    if (!item || item.type !== 'repo') return;
    const repo = item.data;
    setStatus(`  Updating ${repo.name}...`);
    screen.render();
    try {
      updateRepo(infraDir, repo.path);
      setStatus(`{green-fg}✓{/green-fg}  ${repo.name} scaffold updated`);
    } catch (e) {
      setStatus(`{red-fg}✗{/red-fg}  ${e.message}`);
    }
    refreshDetail();
  });

  setStatus(
    '  {bold}↑↓{/bold} navigate   {bold}Enter{/bold} run/init   {bold}e{/bold} effort   {bold}t{/bold} summaries   {bold}u{/bold} update   {bold}q{/bold} quit',
  );
  refreshDetail();
  navList.focus();

  return { navList, detailBox, focus: () => navList.focus() };
}

module.exports = { createConfigPanel };
