import { defineConfig } from 'tsup';

// Gera um único arquivo dist/server.js, já com o pacote @rj/shared embutido.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  noExternal: ['@rj/shared'],
});
