'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const QUEUE_DIR = path.join(os.homedir(), '.claude-scaffold');
const QUEUE_PATH = path.join(QUEUE_DIR, 'tasks.json');

function _read() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  } catch {
    return { tasks: [] };
  }
}

function _write(data) {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
  const tmp = QUEUE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, QUEUE_PATH);
}

function enqueue(task) {
  const q = _read();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...task,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  q.tasks.push(entry);
  _write(q);
  return entry.id;
}

function dequeue() {
  const q = _read();
  const idx = q.tasks.findIndex(t => t.status === 'pending');
  if (idx === -1) return null;
  const task = q.tasks[idx];
  task.status = 'running';
  _write(q);
  return task;
}

function complete(id, result) {
  const q = _read();
  const task = q.tasks.find(t => t.id === id);
  if (task) {
    task.status = 'done';
    task.result = result;
    task.completedAt = new Date().toISOString();
    _write(q);
  }
}

function fail(id, error) {
  const q = _read();
  const task = q.tasks.find(t => t.id === id);
  if (task) {
    task.status = 'failed';
    task.error = String(error);
    _write(q);
  }
}

function list() {
  return _read().tasks;
}

function clear(statusFilter) {
  const q = _read();
  q.tasks = statusFilter
    ? q.tasks.filter(t => !statusFilter.includes(t.status))
    : [];
  _write(q);
}

module.exports = { enqueue, dequeue, complete, fail, list, clear, QUEUE_PATH };
