import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  bundle: true,
  splitting: false,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  external: ['commander', 'inquirer', 'chalk', 'execa']
});
