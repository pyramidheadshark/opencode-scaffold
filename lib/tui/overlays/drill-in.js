'use strict';

const XTerm = require('blessed-xterm');

function createDrillInOverlay(screen, blessed, agentPool, agentId, setStatus) {
  const agent = agentPool.get(agentId);
  if (!agent) {
    setStatus('{red-fg}Drill-in: agent not found{/red-fg}');
    return null;
  }

  const cols = Math.floor(screen.width * 0.92);
  const rows = Math.floor(screen.height * 0.88);
  const left = Math.floor((screen.width - cols) / 2);
  const top  = Math.floor((screen.height - rows) / 2);

  const terminal = new XTerm({
    top,
    left,
    width:      cols,
    height:     rows,
    border:     { type: 'line' },
    style:      { border: { fg: 'yellow' }, focus: { border: { fg: 'yellow' } } },
    label:      ` {yellow-fg}Agent #${agentId}{/yellow-fg}: ${agent.name}  {gray-fg}[Ctrl+Q to exit]{/gray-fg} `,
    tags:       true,
    shell:      null,
    scrollback: 3000,
    controlKey: 'C-w',
  });
  screen.append(terminal);

  terminal.injectInput = (data) => {
    if (!closed) agentPool.write(agentId, data);
  };

  const innerCols = cols - 2;
  const innerRows = rows - 2;

  const initialData = agent.displayBuffer || agent.output.slice(-30000);
  if (initialData) terminal.write(initialData);

  // Resize after snapshot so Claude redraws fresh, placing cursor at prompt
  agentPool.resize(agentId, innerCols, innerRows);

  const onData = (id, data) => {
    if (id !== agentId) return;
    terminal.write(data);
  };
  agentPool.on('data', onData);

  const onExit = (id) => {
    if (id !== agentId) return;
    setStatus(`{gray-fg}Agent #${agentId} exited — Ctrl+Q to close{/gray-fg}`);
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
    terminal.destroy();
    try { agentPool.resize(agentId, 220, 50); } catch { }
    screen.render();
    setStatus('Drill-in closed');
  }

  function keypressHandler(ch, key) {
    if (!key) return;
    if (key.full === 'C-q' || (key.ctrl && key.name === 'q')) {
      close();
    }
  }

  screen.grabKeys = true;
  screen.program.on('keypress', keypressHandler);

  terminal.focus();
  screen.render();
  setStatus(`{yellow-fg}Drill-in:{/yellow-fg} agent #${agentId} — {bold}Ctrl+Q{/bold} to exit  {gray-fg}Ctrl+W scroll mode{/gray-fg}`);

  return { close };
}

module.exports = { createDrillInOverlay };
