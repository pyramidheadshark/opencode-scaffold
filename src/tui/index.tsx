import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';

// Define state type based on Phase 9 of the design doc
type AgentState = {
  repo: string;
  status: string;
  command: string;
  tokens: number | string;
  cost: string;
  memoryBank: string;
};

const SimpleTable = ({ data }: { data: any[] }) => {
  if (data.length === 0) return null;
  const keys = Object.keys(data[0]);
  
  // Calculate column widths
  const colWidths: Record<string, number> = {};
  for (const key of keys) {
    colWidths[key] = Math.max(
      key.length,
      ...data.map((row) => String(row[key] || '').length)
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single">
      {/* Header */}
      <Box borderBottom={false}>
        {keys.map((key) => (
          <Box key={key} width={colWidths[key] + 4}>
            <Text bold color="cyan">{key.toUpperCase()}</Text>
          </Box>
        ))}
      </Box>
      {/* Rows */}
      {data.map((row, i) => (
        <Box key={i}>
          {keys.map((key) => (
            <Box key={key} width={colWidths[key] + 4}>
              <Text>{String(row[key] || '')}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

export const TowerDashboard = () => {
  const [agents, setAgents] = useState<AgentState[]>([]);

  useEffect(() => {
    const stateDir = path.join(process.cwd(), '.opencode-global-state');
    fs.mkdir(stateDir, { recursive: true }).catch(() => {});

    const loadStates = async () => {
      try {
        const files = await fs.readdir(stateDir);
        const newAgents: AgentState[] = [];

        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const content = await fs.readFile(path.join(stateDir, file), 'utf-8');
              const state = JSON.parse(content);
              newAgents.push({
                repo: file.replace('.json', ''),
                status: state.status || 'Idle',
                tokens: state.tokens || 0,
                cost: state.cost || '$0.00',
                command: state.command || '-',
                memoryBank: state.memoryBank || 'Unknown',
              });
            } catch (e) {}
          }
        }
        setAgents(newAgents);
      } catch (err) {}
    };

    loadStates();
    const interval = setInterval(loadStates, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          OpenCode Control Tower
        </Text>
      </Box>

      {agents.length === 0 ? (
        <Text color="gray">No active OpenCode sessions detected in .opencode-global-state/</Text>
      ) : (
        <SimpleTable data={agents} />
      )}
    </Box>
  );
};

export async function towerCommand() {
  if (process.stdout.isTTY) {
    console.clear();
  }
  
  // if debug mode is needed to output to non-TTY:
  const isDebug = process.env.DEBUG_INK === '1';
  
  const { unmount } = render(<TowerDashboard />, isDebug ? { debug: true } : {});
  
  process.on('SIGTERM', () => {
    unmount();
    process.exit(0);
  });
}
