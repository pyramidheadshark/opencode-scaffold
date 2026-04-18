'use strict';

const { listRepos, getSkillRules } = require('../config-manager');

function createConfigPanel(screen, blessed) {
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
      ? repos.map(r => ` ${r.name.slice(0, 18).padEnd(18)} ${r.infraSha.slice(0, 7)}`)
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

  function renderDetail(idx) {
    if (repos.length === 0) {
      detailBox.setContent('  No repos deployed yet.\n\n  Run: claude-scaffold init <path>');
      detailBox.setLabel(' Details ');
      screen.render();
      return;
    }
    const repo = repos[idx];
    const rules = getSkillRules(repo.path);

    const lines = [
      `  {bold}${repo.name}{/bold}`,
      '',
      `  Path       : ${repo.path}`,
      `  Deployed   : ${repo.deployedAt || '—'}`,
      `  SHA        : ${repo.infraSha || '—'}`,
      `  CI Profile : ${repo.ciProfile || '—'}`,
      `  Deploy To  : ${repo.deployTarget || '—'}`,
      '',
      `  Skills (${repo.skills.length}):`,
      ...repo.skills.map(s => `    {green-fg}•{/green-fg} ${s}`),
    ];

    if (rules.length > 0) {
      lines.push('', `  Skill Rules (${rules.length}):`);
      for (const rule of rules) {
        const prio = rule.priority !== undefined ? ` {yellow-fg}prio:${rule.priority}{/yellow-fg}` : '';
        const always = rule.triggers && rule.triggers.always_load ? ' {cyan-fg}[always]{/cyan-fg}' : '';
        lines.push(`    {green-fg}•{/green-fg} ${rule.skill}${prio}${always}`);
      }
    } else {
      lines.push('', '  {gray-fg}No skill-rules.json or path unreachable{/gray-fg}');
    }

    detailBox.setContent(lines.join('\n'));
    detailBox.setLabel(` ${repo.name} `);
    screen.render();
  }

  listBox.on('select item', (item, idx) => {
    selectedIdx = idx;
    renderDetail(idx);
  });

  listBox.key(['up', 'down', 'k', 'j'], () => {
    screen.render();
  });

  renderDetail(0);
  listBox.focus();

  return {
    listBox,
    detailBox,
    focus: () => listBox.focus(),
  };
}

module.exports = { createConfigPanel };
