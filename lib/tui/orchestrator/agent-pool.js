'use strict';

const EventEmitter = require('events');
const os = require('os');
const path = require('path');

const MAX_AGENTS = Math.max(2, Math.floor(os.cpus().length / 2));
const BLOCKED_MARKER = '[SCAFFOLD:BLOCKED]';

class AgentPool extends EventEmitter {
  constructor() {
    super();
    this._agents = new Map();
    this._nextId = 1;
    this._pty = null;
    try {
      this._pty = require('@lydell/node-pty');
    } catch {
      this._pty = null;
    }
  }

  isPtyAvailable() {
    return this._pty !== null;
  }

  maxAgents() {
    return MAX_AGENTS;
  }

  spawn(targetDir, task) {
    if (!this._pty) throw new Error('node-pty not available — cannot spawn agent');
    if (this._agents.size >= MAX_AGENTS) throw new Error(`Agent pool full (max ${MAX_AGENTS})`);

    const id = this._nextId++;
    const ptyProcess = this._pty.spawn(
      process.platform === 'win32' ? 'cmd.exe' : 'claude',
      [],
      {
        name: 'xterm-256color',
        cols: 220,
        rows: 50,
        cwd: targetDir,
        env: { ...process.env, TERM: 'xterm-256color' },
      },
    );

    const agent = {
      id,
      targetDir,
      task,
      status: 'running',
      pty: ptyProcess,
      output: '',
      startedAt: new Date().toISOString(),
    };

    ptyProcess.onData(data => {
      agent.output += data;
      if (agent.status === 'running' && agent.output.includes(BLOCKED_MARKER)) {
        agent.status = 'blocked';
        this.emit('blocked', id);
      }
      this.emit('data', id, data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      agent.status = exitCode === 0 ? 'done' : 'stopped';
      this._agents.delete(id);
      this.emit('exit', id, exitCode);
    });

    this._agents.set(id, agent);
    this.emit('spawned', id);
    return id;
  }

  write(id, data) {
    const agent = this._agents.get(id);
    if (agent && agent.pty) agent.pty.write(data);
  }

  resize(id, cols, rows) {
    const agent = this._agents.get(id);
    if (agent && agent.pty) agent.pty.resize(cols, rows);
  }

  kill(id) {
    const agent = this._agents.get(id);
    if (!agent) return;
    try { agent.pty.kill(); } catch { }
    agent.status = 'stopped';
    this._agents.delete(id);
    this.emit('exit', id, -1);
  }

  get(id) {
    return this._agents.get(id) || null;
  }

  list() {
    return Array.from(this._agents.values()).map(a => ({
      id: a.id,
      targetDir: a.targetDir,
      name: path.basename(a.targetDir),
      task: a.task,
      status: a.status,
      startedAt: a.startedAt,
    }));
  }
}

module.exports = { AgentPool, MAX_AGENTS, BLOCKED_MARKER };
