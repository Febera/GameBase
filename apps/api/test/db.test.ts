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
import { createIgdbSteamRepository } from '../src/db/igdbSteamRepository.js';
import { createSnapshotRepository } from '../src/db/snapshotRepository.js';

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

  it('guarda e lê os vínculos IGDB → Steam nos dois sentidos', async () => {
    const repo = createIgdbSteamRepository(pool);
    const at = new Date('2026-10-20T12:00:00Z');
    await repo.upsertMany([
      { igdbId: 1, steamAppId: 730, checkedAt: at },
      { igdbId: 2, steamAppId: null, checkedAt: at },
      { igdbId: 3, steamAppId: 730, checkedAt: at }, // outra edição do mesmo App ID
    ]);
    await repo.upsertMany([{ igdbId: 2, steamAppId: 440, checkedAt: at }]);
    const byIgdb = await repo.findByIgdb([1, 2, 9]);
    expect([...byIgdb.keys()].sort()).toEqual([1, 2]);
    expect(byIgdb.get(2)).toMatchObject({ steamAppId: 440 });
    expect(byIgdb.get(1)?.checkedAt.toISOString()).toBe('2026-10-20T12:00:00.000Z');
    expect([...(await repo.findBySteam([730, 440, 5]))].sort((a, b) => a[0] - b[0])).toEqual([
      [440, 2],
      [730, 1],
    ]);
  });

  it('atualiza só o preço (em lote) e só as avaliações, cada um com sua data', async () => {
    const repo = createSteamAppsRepository(pool);
    await repo.upsert(app(10));
    await repo.upsert(app(20));
    const later = new Date('2026-10-21T08:00:00Z');
    await repo.updatePrices(
      [
        { appId: 10, price: { currency: 'BRL', initial: 4999, final: 999, discountPercent: 80 } },
        { appId: 20, price: null },
        { appId: 99, price: null }, // não está no banco: ignorado
      ],
      later,
    );
    await repo.updateReviews(20, null, later);
    const found = await repo.findMany([10, 20, 99]);
    expect(found.size).toBe(2);
    expect(found.get(10)).toMatchObject({ price: { final: 999, discountPercent: 80 }, reviews: { total: 534170 } });
    expect(found.get(10)?.priceFetchedAt?.toISOString()).toBe(later.toISOString());
    expect(found.get(10)?.reviewsFetchedAt?.toISOString()).toBe('2026-10-20T12:00:00.000Z');
    expect(found.get(20)).toMatchObject({ price: null, reviews: null });
    expect(found.get(20)?.reviewsFetchedAt?.toISOString()).toBe(later.toISOString());
    expect(found.get(20)?.fetchedAt.toISOString()).toBe('2026-10-20T12:00:00.000Z'); // detalhes intactos
  });

  it('ranking bayesiano no banco: 500+ avaliações, poucas avaliações puxadas para a média', async () => {
    const repo = createSteamAppsRepository(pool);
    await repo.upsert(app(1, { reviews: { total: 520, percent: 99 } }));
    await repo.upsert(app(2, { reviews: { total: 80_000, percent: 95 } }));
    await repo.upsert(app(3, { reviews: { total: 120, percent: 100 } })); // abaixo do mínimo
    await repo.upsert(app(4, { reviews: { total: 40_000, percent: 70 } }));
    await repo.upsert(app(5, { found: false, reviews: null }));
    expect(await repo.topRated(500, 10)).toEqual([2, 1, 4]); // mesma ordem de bayesianRank
    expect(await repo.topRated(500, 2)).toEqual([2, 1]);
  });

  it('salva e lê listas em cache (JSON), substituindo a versão anterior', async () => {
    const repo = createSnapshotRepository(pool);
    expect(await repo.load('deals:safe')).toBeNull();
    await repo.save('deals:safe', [{ id: 'a', cut: 90 }], new Date('2026-10-20T12:00:00Z'));
    await repo.save('deals:safe', [{ id: 'b', cut: 75, title: 'Ação "rápida"' }], new Date('2026-10-20T13:00:00Z'));
    const saved = await repo.load('deals:safe');
    expect(saved?.value).toEqual([{ id: 'b', cut: 75, title: 'Ação "rápida"' }]);
    expect(saved?.savedAt.toISOString()).toBe('2026-10-20T13:00:00.000Z');
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
