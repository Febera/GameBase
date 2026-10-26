import pg from 'pg';
import type { DbPool } from './types.js';

/** Pool de conexões com o Postgres (Neon). */
export function createPool(connectionString: string): pg.Pool & DbPool {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    // O Neon "acorda" o banco na primeira conexão, o que pode levar alguns segundos.
    connectionTimeoutMillis: 15_000,
  });
  pool.on('error', (error) => {
    console.error('Erro em conexão ociosa com o banco:', error.message);
  });
  return pool as pg.Pool & DbPool;
}
