/**
 * Roda as migrações pela linha de comando: npm run migrate -w @rj/api
 * Usa DATABASE_DIRECT_URL (sem pooler), ou DATABASE_URL se a direta não existir.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, readMigrations } from './migrate.js';
import { createPool } from './pool.js';

const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_DIRECT_URL (ou DATABASE_URL) no apps/api/.env.');
  process.exit(1);
}

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const pool = createPool(url);
try {
  const applied = await migrate(pool, await readMigrations(dir));
  console.log(applied.length ? `Migrações aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
