'use strict';

const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

function resolveClaudeBin() {
  const strategies = [
    () => execSync('bash -c "command -v claude"', { encoding: 'utf8', timeout: 3000 }).trim(),
    () => execSync('which claude', { encoding: 'utf8', timeout: 3000 }).trim(),
  ];
  for (const fn of strategies) {
    try {
      const p = fn();
      if (p && !p.includes(' ') && fs.existsSync(p)) return p;
    } catch { }
  }
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
    path.join(os.homedir(), '.nvm', 'versions', 'node', process.version, 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

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
    if (this.activeCount() >= MAX_AGENTS) throw new Error(`Agent pool full — ${this.activeCount()} active (max ${MAX_AGENTS})`);

    targetDir = targetDir.replace(/\\ /g, ' ').trim();
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory not found: ${targetDir}`);
    }

    let bin = 'cmd.exe';
    if (process.platform !== 'win32') {
      bin = resolveClaudeBin();
      if (!bin) throw new Error('claude not found in PATH — install: npm i -g @anthropic-ai/claude-code');
    }

    const id = this._nextId++;
    let ptyProcess;
    try {
      ptyProcess = this._pty.spawn(bin, ['--dangerously-skip-permissions'], {
        name: 'xterm-256color',
        cols: 220,
        rows: 50,
        cwd: targetDir,
        env: { ...process.env, TERM: 'xterm-256color', ENABLE_TOOL_SEARCH: 'true' },
      });
    } catch (e) {
      throw new Error(`Failed to spawn ${bin}: ${e.message}`);
    }

    const agent = {
      id,
      targetDir,
      name: path.basename(targetDir),
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
      agent.exitCode = exitCode;
      agent.exitedAt = new Date().toISOString();
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
    agent.exitCode = -1;
    agent.exitedAt = new Date().toISOString();
    this._agents.delete(id);
    this.emit('exit', id, -1);
  }

  remove(id) {
    const agent = this._agents.get(id);
    if (!agent) return false;
    if (agent.status === 'running' || agent.status === 'blocked') return false;
    this._agents.delete(id);
    return true;
  }

  activeCount() {
    let n = 0;
    for (const a of this._agents.values()) {
      if (a.status === 'running' || a.status === 'blocked') n++;
    }
    return n;
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
