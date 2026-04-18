'use strict';

const blessed = require('blessed');
const { createConfigPanel } = require('./panels/config');

function runTui() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'claude-scaffold TUI',
    fullUnicode: true,
  });

  const tabBar = blessed.box({
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
    content: '  {bold}↑↓{/bold} navigate   {bold}Tab{/bold} switch panels   {bold}q{/bold} quit',
    tags: true,
    style: { bg: 'black', fg: 'gray' },
  });

  createConfigPanel(screen, blessed);

  screen.key(['q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.render();
}

module.exports = { runTui };
