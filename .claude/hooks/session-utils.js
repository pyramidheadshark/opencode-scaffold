"use strict";
const fs = require("fs");
const path = require("path");

const WEIGHTS = { Write: 2, Edit: 1, Bash: 0.3, Read: 0 };

function getSessionJsonlPath(cwd, sessionId, dateStr) {
  const d = dateStr || new Date().toISOString().slice(0, 10);
  const idShort = (sessionId || "unknown").slice(0, 8);
  return path.join(cwd, ".claude", "logs", "sessions", `session-${d}-${idShort}.jsonl`);
}

function appendSessionEvent(cwd, sessionId, event) {
  try {
    const filePath = getSessionJsonlPath(cwd, sessionId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf8");
  } catch { }
}

function deleteOldSessionLogs(logsDir, maxFiles) {
  try {
    if (!fs.existsSync(logsDir)) return;
    const files = fs.readdirSync(logsDir)
      .filter(f => f.startsWith("session-") && f.endsWith(".jsonl"))
      .sort();
    while (files.length > maxFiles) {
      const oldest = files.shift();
      try { fs.unlinkSync(path.join(logsDir, oldest)); } catch { }
    }
  } catch { }
}

module.exports = { WEIGHTS, getSessionJsonlPath, appendSessionEvent, deleteOldSessionLogs };
