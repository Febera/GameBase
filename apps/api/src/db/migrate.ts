import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DbPool } from './types.js';

export interface Migration {
  name: string;
  sql: string;
}

/** Lê os arquivos .sql da pasta, em ordem alfabética (001_, 002_ ...). */
export async function readMigrations(dir: string): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (name) => ({ name, sql: await readFile(path.join(dir, name), 'utf8') })),
  );
}

/**
 * Aplica as migrações ainda não aplicadas, registrando cada uma em schema_migrations.
 * Cada migração roda numa transação: ou entra inteira, ou não entra.
 * Devolve os nomes das migrações aplicadas agora.
 */
export async function migrate(pool: DbPool, migrations: Migration[]): Promise<string[]> {
  // Uma única conexão: BEGIN, comandos e COMMIT precisam ir pela mesma.
  const db = await pool.connect();
  try {
    return await applyPending(db, migrations);
  } finally {
    db.release();
  }
}

async function applyPending(
  db: Awaited<ReturnType<DbPool['connect']>>,
  migrations: Migration[],
): Promise<string[]> {
  // Impede que dois servidores subindo juntos apliquem a mesma migração.
  await db.query('SELECT pg_advisory_lock(727274)');
  try {
    return await applyLocked(db, migrations);
  } finally {
    await db.query('SELECT pg_advisory_unlock(727274)');
  }
}

async function applyLocked(
  db: Awaited<ReturnType<DbPool['connect']>>,
  migrations: Migration[],
): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const { rows } = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  const applied: string[] = [];
  for (const migration of migrations) {
    if (done.has(migration.name)) continue;
    await db.query('BEGIN');
    try {
      await db.query(migration.sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
      await db.query('COMMIT');
      applied.push(migration.name);
    } catch (error) {
      await db.query('ROLLBACK');
      throw new Error(`Falha na migração ${migration.name}: ${(error as Error).message}`);
    }
  }
  return applied;
}
