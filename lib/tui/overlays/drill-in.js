'use strict';

const { stripAnsi } = require('../ansi-strip');

function createDrillInOverlay(screen, blessed, agentPool, agentId, setStatus) {
  const agent = agentPool.get(agentId);
  if (!agent) {
    setStatus('{red-fg}Drill-in: agent not found{/red-fg}');
    return null;
  }

  const cols = Math.floor(screen.width * 0.92);
  const rows = Math.floor(screen.height * 0.88);
  const left = Math.floor((screen.width - cols) / 2);
  const top = Math.floor((screen.height - rows) / 2);

  const overlay = blessed.box({
    parent: screen,
    top,
    left,
    width: cols,
    height: rows,
    border: { type: 'line' },
    style: { border: { fg: 'yellow' }, bg: 'black' },
    label: ` {yellow-fg}Agent #${agentId}{/yellow-fg}: ${agent.targetDir}  {gray-fg}[ESC to exit]{/gray-fg} `,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '│', style: { bg: 'gray' } },
    content: '',
  });

  function syncContent() {
    overlay.setContent(stripAnsi(agent.output));
    overlay.setScrollPerc(100);
    screen.render();
  }

  syncContent();
  agentPool.resize(agentId, cols - 2, rows - 2);

  const onData = (id) => {
    if (id !== agentId) return;
    syncContent();
  };
  agentPool.on('data', onData);

  const onExit = (id) => {
    if (id !== agentId) return;
    syncContent();
    setStatus(`{gray-fg}Agent #${agentId} exited — ESC to close{/gray-fg}`);
  };
  agentPool.on('exit', onExit);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    screen.grabKeys = false;
    agentPool.removeListener('data', onData);
    agentPool.removeListener('exit', onExit);
    screen.removeAllListeners('keypress');
    overlay.destroy();
    agentPool.resize(agentId, 220, 50);
    screen.render();
    setStatus('Drill-in closed');
  }

  screen.grabKeys = true;

  screen.on('keypress', (ch, key) => {
    if (!screen.grabKeys) return;

    if (key.name === 'escape') {
      close();
      return;
    }

    if (key.ctrl && key.name === 'c') {
      agentPool.write(agentId, '\x03');
    } else if (key.name === 'return' || key.name === 'enter') {
      agentPool.write(agentId, '\r');
    } else if (key.name === 'backspace') {
      agentPool.write(agentId, '\x7f');
    } else if (key.name === 'up') {
      agentPool.write(agentId, '\x1b[A');
    } else if (key.name === 'down') {
      agentPool.write(agentId, '\x1b[B');
    } else if (key.name === 'left') {
      agentPool.write(agentId, '\x1b[D');
    } else if (key.name === 'right') {
      agentPool.write(agentId, '\x1b[C');
    } else if (key.name === 'tab') {
      agentPool.write(agentId, '\t');
    } else if (ch) {
      agentPool.write(agentId, ch);
    }
  });

  overlay.focus();
  screen.render();
  setStatus(`{yellow-fg}Drill-in:{/yellow-fg} agent #${agentId} | type to interact | {bold}ESC{/bold} to exit`);

  return { close };
}

module.exports = { createDrillInOverlay };
