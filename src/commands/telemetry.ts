import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import sqlite3 from 'sqlite3';

export async function telemetryServerCommand() {
  console.log(chalk.cyan.bold('\n📡 Starting local telemetry server (OTLP to SQLite)...\n'));
  
  const cwd = process.cwd();
  const opencodeDir = path.join(cwd, '.opencode');
  const dbPath = path.join(opencodeDir, 'telemetry.db');
  
  await fs.mkdir(opencodeDir, { recursive: true });

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(chalk.red(`Failed to open DB: ${err.message}`));
      process.exit(1);
    }
  });

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT,
        span_id TEXT,
        name TEXT,
        start_time_unix_nano INTEGER,
        end_time_unix_nano INTEGER,
        payload TEXT
      )
    `);
  });

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // OTLP trace receiver endpoint
  app.post('/v1/traces', (req, res) => {
    try {
      const tracesData = req.body;
      const resourceSpans = tracesData.resourceSpans || [];
      
      const stmt = db.prepare('INSERT INTO traces (trace_id, span_id, name, start_time_unix_nano, end_time_unix_nano, payload) VALUES (?, ?, ?, ?, ?, ?)');

      let count = 0;
      for (const rs of resourceSpans) {
        for (const scopeSpan of (rs.scopeSpans || [])) {
          for (const span of (scopeSpan.spans || [])) {
            stmt.run([
              span.traceId,
              span.spanId,
              span.name,
              span.startTimeUnixNano,
              span.endTimeUnixNano,
              JSON.stringify(span)
            ]);
            count++;
          }
        }
      }

      stmt.finalize();
      console.log(chalk.green(`Recorded ${count} spans.`));
      res.status(200).send({ message: 'Success' });
    } catch (e: any) {
      console.error(chalk.red(`Error saving traces: ${e.message}`));
      res.status(500).send({ error: e.message });
    }
  });

  const PORT = 4318;
  const server = app.listen(PORT, () => {
    console.log(chalk.green(`Connected to local DB at ${dbPath}`));
    console.log(chalk.gray(`Listening on port ${PORT} for OpenTelemetry HTTP traces...`));
    console.log(chalk.gray('Press Ctrl+C to exit.'));
  });

  process.on('SIGTERM', () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
