import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes de banco apagam e recriam as tabelas: um arquivo por vez evita conflito entre eles.
    fileParallelism: false,
  },
});
