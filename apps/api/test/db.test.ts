/**
 * Testes contra um Postgres de verdade. Rode com TEST_DATABASE_URL apontando para um
 * banco descartável (as tabelas são apagadas a cada teste). Sem a variável, são pulados.
 */
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate, readMigrations } from '../src/db/migrate.js';
import { createSteamAppsRepository, type SteamApp } from '../src/db/steamAppsRepository.js';
import type { DbPool } from '../src/db/types.js';

const url = process.env.TEST_DATABASE_URL;
const migrationsDir = path.resolve(__dirname, '../migrations');

const app = (appId: number, extra: Partial<SteamApp> = {}): SteamApp => ({
  appId,
  found: true,
  isFree: false,
  hasDemo: true,
  adultContent: false,
  price: { currency: 'BRL', initial: 4999, final: 2499, discountPercent: 50 },
  reviews: { total: 534170, percent: 90 },
  fetchedAt: new Date('2026-10-20T12:00:00Z'),
  ...extra,
});

describe.skipIf(!url)('banco (Postgres real)', () => {
  const pool = new pg.Pool({ connectionString: url }) as pg.Pool & DbPool;

  beforeEach(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(pool, await readMigrations(migrationsDir));
  });
  afterAll(() => pool.end());

  it('aplica as migrações uma vez só', async () => {
    expect(await migrate(pool, await readMigrations(migrationsDir))).toEqual([]);
  });

  it('grava, atualiza e lê dados da Steam', async () => {
    const repo = createSteamAppsRepository(pool);
    await repo.upsert(app(10));
    await repo.upsert(app(20, { isFree: true, hasDemo: false, price: null, reviews: null }));
    await repo.upsert(app(10, { price: { currency: 'BRL', initial: 4999, final: 4999, discountPercent: 0 } }));

    const found = await repo.findMany([10, 20, 30]);
    expect([...found.keys()].sort()).toEqual([10, 20]);
    expect(found.get(10)?.price).toEqual({ currency: 'BRL', initial: 4999, final: 4999, discountPercent: 0 });
    expect(found.get(20)).toMatchObject({ isFree: true, hasDemo: false, price: null, reviews: null });
    expect(found.get(10)?.reviews).toEqual({ total: 534170, percent: 90 });
    expect(found.get(20)?.fetchedAt.toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('desfaz a migração inteira quando ela falha', async () => {
    await expect(
      migrate(pool, [
        { name: '998_ok.sql', sql: 'CREATE TABLE parcial (id INT);' },
        { name: '999_quebrada.sql', sql: 'CREATE TABLE y (id INT); CREATE TABLE (;' },
      ]),
    ).rejects.toThrow('999_quebrada.sql');
    const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name');
    const names = rows.map((r) => r.name);
    expect(names).toContain('998_ok.sql');
    expect(names).not.toContain('999_quebrada.sql');
    const y = await pool.query("SELECT to_regclass('public.y') AS t");
    expect(y.rows[0].t).toBeNull();
  });
});
