'use strict';

const path = require('path');
const blessed = require('blessed');
const { createConfigPanel } = require('./panels/config');

const INFRA_DIR = path.join(__dirname, '..', '..');

function runTui() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'claude-scaffold TUI',
    fullUnicode: true,
  });

  blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: '  {bold}claude-scaffold{/bold}  {underline}{white-fg}[Config]{/white-fg}{/underline}  Agents  Pipeline  Artifacts',
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

  createConfigPanel(screen, blessed, INFRA_DIR, setStatus);

  screen.key(['q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.render();
}

module.exports = { runTui };
