'use strict';
const fs = require('fs');
const path = require('path');

function getSessionsDir(targetDir) {
  return path.join(targetDir, '.claude', 'logs', 'sessions');
}

function listSessions(targetDir) {
  const dir = getSessionsDir(targetDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.startsWith('session-') && f.endsWith('.jsonl'))
    .sort()
    .reverse();
}

function readSession(targetDir, filename) {
  const p = path.join(getSessionsDir(targetDir), filename);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8')
    .trim().split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function formatEvent(event) {
  const ts = event.timestamp ? event.timestamp.slice(11, 19) : '?';
  if (event.type === 'session_start') return `  ${ts} START  repo=${event.repo || '?'} platform=${event.platform || '?'}`;
  if (event.type === 'file_change') return `  ${ts} CHANGE ${event.tool || '?'} ${event.path || '?'}`;
  if (event.type === 'destructive_op') return `  ${ts} ⚠  ${event.level || '?'} ${(event.command || '').slice(0, 60)}`;
  if (event.type === 'session_end') return `  ${ts} END    snapshot=${event.snapshot_tag || 'none'} weight=${(event.weight || 0).toFixed(1)}`;
  return `  ${ts} ${event.type || 'event'}`;
}

function run(targetDir, opts, out) {
  const write = out || process.stdout.write.bind(process.stdout);
  const files = listSessions(targetDir);

  if (opts.list || (!opts.session && !opts.tail)) {
    if (files.length === 0) {
      write('No session logs found.\n');
      return;
    }
    write(`Session logs (${files.length}):\n`);
    files.forEach((f, i) => write(`  ${i + 1}. ${f}\n`));
    return;
  }

  let target = null;
  if (opts.session) {
    target = files.find(f => f.includes(opts.session));
    if (!target) { write(`No session matching: ${opts.session}\n`); return; }
  } else {
    target = files[0];
    if (!target) { write('No session logs found.\n'); return; }
  }

  const events = readSession(targetDir, target);
  if (!events) { write(`Could not read: ${target}\n`); return; }

  const slice = opts.tail ? events.slice(-opts.tail) : events;
  write(`\n${target}\n`);
  slice.forEach(e => write(formatEvent(e) + '\n'));
  write('\n');
}

module.exports = { run, listSessions, readSession };
