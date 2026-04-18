'use strict';

const path = require('path');
const blessed = require('blessed');
const { createConfigPanel } = require('./panels/config');
const { createAgentsPanel } = require('./panels/agents');

const INFRA_DIR = path.join(__dirname, '..', '..');
const TABS = ['Config', 'Agents', 'Pipeline', 'Artifacts'];

function runTui() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'claude-scaffold TUI',
    fullUnicode: true,
  });

  let currentTab = 0;

  function tabLabel(name, active) {
    return active
      ? `{bold}{underline}{white-fg}[${name}]{/white-fg}{/underline}{/bold}`
      : `{gray-fg}${name}{/gray-fg}`;
  }

  function renderTabBar() {
    const parts = TABS.map((t, i) => tabLabel(t, i === currentTab));
    header.setContent(`  ${parts.join('  ')}`);
    screen.render();
  }

  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: '',
    tags: true,
    style: { bg: 'blue', fg: 'white' },
  });

  const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: '',
    tags: true,
    style: { bg: 'black', fg: 'gray' },
  });

  function setStatus(msg) {
    statusBar.setContent(`  ${msg}`);
    screen.render();
  }

  const configPanel = createConfigPanel(screen, blessed, INFRA_DIR, setStatus);
  const agentsPanel = createAgentsPanel(screen, blessed, INFRA_DIR, setStatus);

  const panels = [configPanel, agentsPanel, null, null];

  function switchTab(idx) {
    if (idx === currentTab && panels[idx]) return;
    panels.forEach((p, i) => { if (p) (i === idx ? p.show() : p.hide()); });
    currentTab = idx;
    renderTabBar();
    if (!panels[idx]) {
      setStatus(`{gray-fg}Panel "${TABS[idx]}" not yet implemented{/gray-fg}`);
    }
  }

  screen.key('tab', () => {
    if (screen.grabKeys) return;
    let next = (currentTab + 1) % TABS.length;
    while (!panels[next] && next !== currentTab) next = (next + 1) % TABS.length;
    switchTab(next);
  });

  screen.key(['q', 'C-c'], () => {
    if (screen.grabKeys) return;
    screen.destroy();
    process.exit(0);
  });

  switchTab(0);
  screen.render();
}

module.exports = { runTui };
