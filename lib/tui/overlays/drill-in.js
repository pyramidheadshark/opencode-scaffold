'use strict';

const { processAnsi } = require('../ansi-strip');

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
    label: ` {yellow-fg}Agent #${agentId}{/yellow-fg}: ${agent.name}  {gray-fg}[Ctrl+Q to exit]{/gray-fg} `,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '│', style: { bg: 'gray' } },
    keys: false,
    input: false,
    mouse: false,
  });

  function syncContent() {
    const raw = agent.displayBuffer || agent.output.slice(-8000);
    overlay.setContent(processAnsi(raw));
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
    screen.program.removeListener('keypress', keypressHandler);
    overlay.destroy();
    agentPool.resize(agentId, 220, 50);
    screen.render();
    setStatus('Drill-in closed');
  }

  function keypressHandler(ch, key) {
    if (!key) return;

    if (key.full === 'C-q' || (key.ctrl && key.name === 'q')) {
      close();
      return;
    }

    if (key.sequence) {
      agentPool.write(agentId, key.sequence);
    } else if (ch) {
      agentPool.write(agentId, ch);
    }
  }

  screen.grabKeys = true;
  screen.program.on('keypress', keypressHandler);

  overlay.focus();
  screen.render();
  setStatus(`{yellow-fg}Drill-in:{/yellow-fg} agent #${agentId} — type to interact — {bold}Ctrl+Q{/bold} to exit`);

  return { close };
}

module.exports = { createDrillInOverlay };
