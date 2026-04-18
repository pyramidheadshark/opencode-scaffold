'use strict';

const fs = require('fs');
const {
  listRepos,
  getSkillRules,
  getSettings,
  setEffort,
  toggleThinkingSummaries,
  updateRepo,
} = require('../config-manager');

const EFFORT_LEVELS = ['max', 'high', 'medium', 'off'];

function parseEffort(settings) {
  if (!settings || !settings.env) return 'max';
  return settings.env.CLAUDE_CODE_EFFORT_LEVEL || 'max';
}

function parseThinkingSummaries(settings) {
  if (!settings) return 'on';
  return settings.showThinkingSummaries === false ? 'off' : 'on';
}

function buildDetailContent(repo) {
  const repoExists = fs.existsSync(repo.path);
  const rules = repoExists ? getSkillRules(repo.path) : [];
  const settings = repoExists ? getSettings(repo.path) : null;
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
      const prio = rule.priority !== undefined ? ` {yellow-fg}prio:${rule.priority}{/yellow-fg}` : '';
      const always = rule.triggers && rule.triggers.always_load ? ' {cyan-fg}[always]{/cyan-fg}' : '';
      lines.push(`    {green-fg}•{/green-fg} ${rule.skill}${prio}${always}`);
    }
  }

  lines.push(
    '',
    '  {gray-fg}──────────────────────────────────────{/gray-fg}',
    `  {bold}[e]{/bold} effort   {bold}[t]{/bold} summaries   {bold}[u]{/bold} update scaffold`,
  );

  return lines.join('\n');
}

function showEffortPicker(screen, blessed, current, callback) {
  const items = EFFORT_LEVELS.map(e => `  ${e === current ? '▶ ' : '  '}${e}`);

  const picker = blessed.list({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 22,
    height: EFFORT_LEVELS.length + 4,
    border: { type: 'line' },
    label: ' Effort Level ',
    items,
    keys: true,
    vi: true,
    style: {
      item: { fg: 'white' },
      selected: { fg: 'black', bg: 'cyan', bold: true },
      border: { fg: 'yellow' },
      label: { fg: 'yellow' },
    },
  });

  const startIdx = EFFORT_LEVELS.indexOf(current);
  if (startIdx >= 0) picker.select(startIdx);

  picker.key(['escape', 'q'], () => {
    picker.destroy();
    screen.render();
    callback(null);
  });

  picker.on('select', (item, idx) => {
    picker.destroy();
    screen.render();
    callback(EFFORT_LEVELS[idx]);
  });

  picker.focus();
  screen.render();
}

function createConfigPanel(screen, blessed, infraDir, setStatus) {
  const repos = listRepos();
  let selectedIdx = 0;

  const container = blessed.box({
    parent: screen,
    top: 1,
    left: 0,
    width: '100%',
    height: screen.height - 2,
  });

  const listBox = blessed.list({
    parent: container,
    top: 0,
    left: 0,
    width: '35%',
    height: '100%',
    border: { type: 'line' },
    label: ` Repos (${repos.length}) `,
    scrollable: true,
    keys: true,
    vi: true,
    mouse: true,
    style: {
      item: { fg: 'white' },
      selected: { fg: 'black', bg: 'white', bold: true },
      border: { fg: 'cyan' },
      label: { fg: 'cyan' },
    },
    items: repos.length > 0
      ? repos.map(r => ` ${r.name.slice(0, 18).padEnd(18)} ${(r.infraSha || '').slice(0, 7)}`)
      : ['  (no repos deployed)'],
  });

  const detailBox = blessed.box({
    parent: container,
    top: 0,
    left: '35%',
    width: '65%',
    height: '100%',
    border: { type: 'line' },
    label: ' Details ',
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

  function refreshDetail() {
    if (repos.length === 0) {
      detailBox.setContent('  No repos deployed yet.\n\n  Run: claude-scaffold init <path>');
      detailBox.setLabel(' Details ');
    } else {
      const repo = repos[selectedIdx];
      detailBox.setContent(buildDetailContent(repo));
      detailBox.setLabel(` ${repo.name} `);
    }
    screen.render();
  }

  function currentRepo() {
    return repos.length > 0 ? repos[selectedIdx] : null;
  }

  listBox.on('select item', (item, idx) => {
    selectedIdx = idx;
    refreshDetail();
  });

  listBox.key(['up', 'down', 'k', 'j'], () => {
    refreshDetail();
  });

  listBox.key('e', () => {
    const repo = currentRepo();
    if (!repo) return;
    const current = parseEffort(getSettings(repo.path));
    showEffortPicker(screen, blessed, current, (level) => {
      if (!level) { listBox.focus(); return; }
      try {
        setEffort(repo.path, level);
        setStatus(`{green-fg}✓{/green-fg}  effort → {bold}${level}{/bold} for ${repo.name}`);
      } catch (e) {
        setStatus(`{red-fg}✗{/red-fg}  ${e.message}`);
      }
      refreshDetail();
      listBox.focus();
    });
  });

  listBox.key('t', () => {
    const repo = currentRepo();
    if (!repo) return;
    try {
      const result = toggleThinkingSummaries(repo.path);
      const val = result.showThinkingSummaries !== false ? 'on' : 'off';
      setStatus(`{green-fg}✓{/green-fg}  thinking summaries → {bold}${val}{/bold} for ${repo.name}`);
    } catch (e) {
      setStatus(`{red-fg}✗{/red-fg}  ${e.message}`);
    }
    refreshDetail();
  });

  listBox.key('u', () => {
    const repo = currentRepo();
    if (!repo) return;
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

  setStatus('  {bold}↑↓{/bold} navigate   {bold}e{/bold} effort   {bold}t{/bold} summaries   {bold}u{/bold} update   {bold}q{/bold} quit');
  refreshDetail();
  listBox.focus();

  return { listBox, detailBox, focus: () => listBox.focus() };
}

module.exports = { createConfigPanel };
