'use strict';

const path = require('path');
const { AgentPool } = require('../orchestrator/agent-pool');
const { createDrillInOverlay } = require('../overlays/drill-in');
const { processAnsi } = require('../ansi-strip');

const STATUS_ICONS = {
  running: '{green-fg}●{/green-fg}',
  blocked: '{yellow-fg}▲{/yellow-fg}',
  done:    '{gray-fg}✓{/gray-fg}',
  stopped: '{red-fg}✗{/red-fg}',
};

function createAgentsPanel(screen, blessed, infraDir, setStatus) {
  const pool = new AgentPool();

  const agentList = blessed.list({
    parent: screen,
    top: 1,
    left: 0,
    width: '44%',
    height: screen.height - 2,
    border: { type: 'line' },
    label: ' Agents ',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      item: { fg: 'white' },
      selected: { fg: 'black', bg: 'white', bold: true },
      border: { fg: 'green' },
      label: { fg: 'green' },
    },
    hidden: true,
  });

  const detailBox = blessed.box({
    parent: screen,
    top: 1,
    left: '44%',
    width: '56%',
    height: screen.height - 2,
    border: { type: 'line' },
    label: ' Output ',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      border: { fg: 'green' },
      label: { fg: 'green' },
    },
    content: 'No agent selected.\n\n[s] Spawn new agent in a repo\n[Enter] Drill-in (interactive)\n[k] Kill selected agent',
    hidden: true,
  });

  let items = [];
  let promptOpen = false;

  function refresh() {
    const savedIdx = agentList.selected >= 0 ? agentList.selected : 0;
    items = pool.list();
    const ptyOk = pool.isPtyAvailable();
    const rows = items.length > 0
      ? items.map(a => {
          const icon = STATUS_ICONS[a.status] || '{gray-fg}?{/gray-fg}';
          return ` ${icon} #${a.id}  ${a.name.slice(0, 24).padEnd(24)}  ${a.status}`;
        })
      : [ptyOk
          ? ' {gray-fg}No active agents — press [s] to spawn{/gray-fg}'
          : ' {red-fg}node-pty unavailable — run: pnpm approve-builds{/red-fg}'];

    agentList.setItems(rows);
    if (items.length > 0) {
      agentList.select(Math.min(savedIdx, items.length - 1));
    }
    agentList.setLabel(` Agents (${items.length}/${pool.maxAgents()}) `);

    if (items.length === 0) {
      detailBox.setContent('No agent selected.\n\n[s] Spawn new agent in a repo\n[Enter] Drill-in (interactive)\n[k] Kill selected agent');
      detailBox.setLabel(' Output ');
    } else {
      const sel = items[agentList.selected];
      if (sel) updateDetail(sel.id);
    }

    screen.render();
  }

  function updateDetail(id) {
    const agent = pool.get(id);
    if (!agent) return;
    const raw = agent.displayBuffer || agent.output.slice(-6000);
    const clean = processAnsi(raw) || '(no output yet)';
    const footer = (agent.status === 'done' || agent.status === 'stopped')
      ? `\n\n── exited: code ${agent.exitCode ?? '?'} at ${agent.exitedAt ?? '?'} ──`
      : '';
    detailBox.setContent(clean + footer);
    detailBox.setScrollPerc(100);
    detailBox.setLabel(` #${id}: ${agent.name} [${agent.status}] `);
    screen.render();
  }

  pool.on('data', (id) => {
    const sel = items[agentList.selected];
    if (sel && sel.id === id) updateDetail(id);
  });
  pool.on('spawned', () => refresh());
  pool.on('exit', () => refresh());
  pool.on('blocked', (id) => {
    refresh();
    setStatus(`{yellow-fg}▲{/yellow-fg} Agent #${id} BLOCKED — press {bold}Enter{/bold} to drill-in`);
  });

  agentList.on('select item', () => {
    const idx = agentList.selected;
    const agent = items[idx];
    if (agent) updateDetail(agent.id);
  });

  agentList.key('enter', () => {
    if (promptOpen) return;
    const idx = agentList.selected;
    const agent = items[idx];
    if (!agent) { setStatus('No agent selected'); return; }
    if (agent.status !== 'running' && agent.status !== 'blocked') {
      setStatus(`Drill-in only available for running/blocked agents (current: ${agent.status})`);
      return;
    }
    createDrillInOverlay(screen, blessed, pool, agent.id, setStatus);
  });

  agentList.key('s', () => {
    if (promptOpen) return;
    if (!pool.isPtyAvailable()) {
      setStatus('{red-fg}node-pty not available — run: pnpm approve-builds{/red-fg}');
      return;
    }
    if (pool.activeCount() >= pool.maxAgents()) {
      setStatus(`{red-fg}Agent pool full — ${pool.activeCount()} active (max ${pool.maxAgents()}){/red-fg}`);
      return;
    }

    promptOpen = true;
    const prompt = blessed.prompt({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 7,
      border: { type: 'line' },
      label: ' Spawn agent — enter absolute path to repo ',
      tags: true,
      style: { border: { fg: 'yellow' }, label: { fg: 'yellow' } },
    });
    prompt.input('Repo path:', '', (err, value) => {
      promptOpen = false;
      prompt.destroy();
      screen.render();
      if (err || !value || !value.trim()) return;
      try {
        const id = pool.spawn(value.trim(), 'interactive');
        setStatus(`{green-fg}✓{/green-fg} Agent #${id} spawned → ${value.trim()}`);
        refresh();
      } catch (e) {
        setStatus(`{red-fg}✗{/red-fg} Spawn failed: ${e.message}`);
      }
    });
    screen.render();
  });

  agentList.key('k', () => {
    if (promptOpen) return;
    const idx = agentList.selected;
    const agent = items[idx];
    if (!agent) { setStatus('No agent selected'); return; }
    if (agent.status === 'done' || agent.status === 'stopped') {
      setStatus(`Use {bold}[d]{/bold} to remove finished agents`);
      return;
    }
    pool.kill(agent.id);
    setStatus(`{gray-fg}Agent #${agent.id} killed{/gray-fg}`);
    refresh();
  });

  agentList.key('d', () => {
    if (promptOpen) return;
    const idx = agentList.selected;
    const agent = items[idx];
    if (!agent) { setStatus('No agent selected'); return; }
    if (!pool.remove(agent.id)) {
      setStatus(`Cannot remove running/blocked agent — kill it first with {bold}[k]{/bold}`);
      return;
    }
    setStatus(`{gray-fg}Agent #${agent.id} removed{/gray-fg}`);
    refresh();
  });

  refresh();

  return {
    pool,
    show() {
      agentList.show();
      detailBox.show();
      agentList.focus();
      refresh();
      setStatus('  {bold}↑↓{/bold} select   {bold}Enter{/bold} drill-in   {bold}s{/bold} spawn   {bold}k{/bold} kill   {bold}d{/bold} remove done   {bold}Tab{/bold} switch panel');
      screen.render();
    },
    hide() {
      agentList.hide();
      detailBox.hide();
    },
  };
}

module.exports = { createAgentsPanel };
