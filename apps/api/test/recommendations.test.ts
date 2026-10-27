/**
 * Placar de recomendações contra um Postgres de verdade (TEST_DATABASE_URL).
 * Sem a variável, os testes do repositório são pulados; os do serviço rodam com um repositório falso.
 */
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IgdbClient } from '../src/clients/igdb.js';
import { migrate, readMigrations } from '../src/db/migrate.js';
import {
  createRecommendationsRepository,
  REMOVE_THRESHOLD,
  type RecommendationRow,
  type RecommendationsRepository,
} from '../src/db/recommendationsRepository.js';
import type { DbPool } from '../src/db/types.js';
import { MissingConfigError, NotFoundError } from '../src/lib/errors.js';
import { createRecommendationsService } from '../src/services/recommendationsService.js';
import { MemoryCache } from '../src/cache/memoryCache.js';
import { adultFilter, lookupStub, steamApp, steamSyncStub } from './stubs.js';

const url = process.env.TEST_DATABASE_URL;
const game = (id: number) => ({ igdbId: id, name: `Jogo ${id}`, slug: `j${id}`, coverImageId: `c${id}` });

describe.skipIf(!url)('repositório de recomendações (Postgres real)', () => {
  const pool = new pg.Pool({ connectionString: url }) as pg.Pool & DbPool;
  const repo = createRecommendationsRepository(pool);

  beforeEach(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(pool, await readMigrations(path.resolve(__dirname, '../migrations')));
  });
  afterAll(() => pool.end());

  it('recomendar cria a entrada com o apoio de quem recomendou', async () => {
    await repo.recommend(game(1), 'ana');
    await repo.recommend(game(1), 'ana'); // repetir não duplica
    const row = await repo.get(1, 'ana');
    expect(row).toMatchObject({ name: 'Jogo 1', upvotes: 1, removeVotes: 0, votedUp: true, votedRemove: false });
    expect((await repo.get(1, 'bia'))?.votedUp).toBe(false);
  });

  it('ordena por votos e, no empate, pelo mais antigo', async () => {
    await repo.recommend(game(1), 'ana');
    await repo.recommend(game(2), 'ana');
    await repo.recommend(game(3), 'ana');
    await repo.setVote(3, 'bia', 'up', true);
    const list = await repo.list('bia');
    expect(list.map((r) => [r.igdbId, r.upvotes])).toEqual([
      [3, 2],
      [1, 1],
      [2, 1],
    ]);
    expect(list[0]?.votedUp).toBe(true);
  });

  it('liga e desliga votos, um por votante', async () => {
    await repo.recommend(game(1), 'ana');
    await repo.setVote(1, 'bia', 'up', true);
    await repo.setVote(1, 'bia', 'up', true);
    expect((await repo.get(1, 'bia'))?.upvotes).toBe(2);
    await repo.setVote(1, 'bia', 'up', false);
    expect((await repo.get(1, 'bia'))?.upvotes).toBe(1);
    expect(await repo.setVote(99, 'bia', 'up', true)).toBe('not_found');
  });

  it(`sai do placar com ${REMOVE_THRESHOLD} pedidos de remoção e volta zerado se recomendado de novo`, async () => {
    await repo.recommend(game(1), 'ana');
    for (const voter of ['v1', 'v2', 'v3', 'v4']) expect(await repo.setVote(1, voter, 'up', true)).toBe('ok');
    for (const voter of ['v1', 'v2', 'v3', 'v4']) expect(await repo.setVote(1, voter, 'remove', true)).toBe('ok');
    expect((await repo.get(1, 'x'))?.removeVotes).toBe(4);
    expect(await repo.setVote(1, 'v5', 'remove', true)).toBe('removed');
    expect(await repo.get(1, 'x')).toBeNull();

    await repo.recommend(game(1), 'zeca');
    expect(await repo.get(1, 'zeca')).toMatchObject({ upvotes: 1, removeVotes: 0 });
  });

  it('pedidos de remoção simultâneos não deixam passar do limite', async () => {
    await repo.recommend(game(1), 'ana');
    const outcomes = await Promise.all(
      Array.from({ length: REMOVE_THRESHOLD + 2 }, (_, i) => repo.setVote(1, `v${i}`, 'remove', true)),
    );
    expect(outcomes.filter((o) => o === 'removed')).toHaveLength(1);
    expect(await repo.get(1, 'x')).toBeNull();
  });
});

/** Repositório em memória, só para testar as regras do serviço. */
function memoryRepo(): RecommendationsRepository & { rows: Map<number, RecommendationRow> } {
  const rows = new Map<number, RecommendationRow>();
  return {
    rows,
    async list() {
      return [...rows.values()];
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async recommend(g) {
      rows.set(g.igdbId, {
        igdbId: g.igdbId,
        name: g.name,
        slug: g.slug,
        coverImageId: g.coverImageId,
        recommendedAt: new Date('2026-10-01T00:00:00Z'),
        upvotes: 1,
        removeVotes: 0,
        votedUp: true,
        votedRemove: false,
      });
    },
    setVote: vi.fn(async (id: number) => (rows.has(id) ? 'ok' : 'not_found')) as RecommendationsRepository['setVote'],
  };
}

const igdb: IgdbClient = {
  query: vi.fn(async (_e: string, body: string) =>
    body.includes('where id = 404;') ? [] : [{ id: 1, name: 'Jogo da IGDB', slug: 'jogo', cover: { image_id: 'capa' } }],
  ) as IgdbClient['query'],
};

describe('serviço de recomendações', () => {
  it('recomenda buscando nome e capa na IGDB, e 404 se o jogo não existe', async () => {
    const repo = memoryRepo();
    const service = createRecommendationsService({ repo, igdb, adult: adultFilter() });
    const status = await service.recommend(1, 'ana');
    expect(status.entry?.game).toMatchObject({ id: 1, name: 'Jogo da IGDB' });
    expect(status.entry?.game.cover?.url).toContain('capa.jpg');
    await expect(service.recommend(404, 'ana')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('recomendar algo que já está no placar vira apoio', async () => {
    const repo = memoryRepo();
    const service = createRecommendationsService({ repo, igdb, adult: adultFilter() });
    await repo.recommend(game(1), 'ana');
    repo.rows.set(1, { ...repo.rows.get(1)!, votedUp: false });
    await service.recommend(1, 'bia');
    expect(repo.setVote).toHaveBeenCalledWith(1, 'bia', 'up', true);
  });

  it('esconde adultos com o filtro ligado, mas conta quantos ficaram ocultos', async () => {
    const repo = memoryRepo();
    await repo.recommend(game(1), 'a');
    await repo.recommend(game(2), 'a');
    const service = createRecommendationsService({ repo, igdb, adult: adultFilter([2]) });
    const hidden = await service.board('a', 'hide');
    expect(hidden.entries.map((e) => e.game.id)).toEqual([1]);
    expect(hidden.hidden).toBe(1);
    expect((await service.board('a', 'show')).entries).toHaveLength(2);
  });

  it('acrescenta preço, demo e jogadores a cada jogo do placar', async () => {
    const repo = memoryRepo();
    await repo.recommend(game(1), 'a');
    await repo.recommend(game(2), 'a');
    const igdbModes: IgdbClient = {
      query: vi.fn(async () => [{ id: 1, multiplayer_modes: [{ platform: 6, onlinecoopmax: 4 }] }]) as IgdbClient['query'],
    };
    const service = createRecommendationsService({
      repo,
      igdb: igdbModes,
      adult: adultFilter(),
      lookup: lookupStub({ steamAppIdsFor: async () => new Map([[1, 101], [2, 102]]) }),
      steam: steamSyncStub([
        steamApp(101, { hasDemo: true, price: { currency: 'BRL', initial: 6000, final: 3000, discountPercent: 50 } }),
        steamApp(102, { isFree: true, price: null }),
      ]),
      cache: new MemoryCache(),
    });
    const [first, second] = (await service.board('a', 'hide')).entries;
    expect(first).toMatchObject({ hasDemo: true, players: { onlineCoopMax: 4 } });
    expect(first?.game.price?.cut).toBe(50);
    expect(second).toMatchObject({ hasDemo: false, players: null, game: { free: true } });
  });

  it('traz a arte larga (arte, senão screenshot) e os gêneros de cada jogo', async () => {
    const repo = memoryRepo();
    await repo.recommend(game(1), 'a');
    await repo.recommend(game(2), 'a');
    await repo.recommend(game(3), 'a');
    const igdbArt: IgdbClient = {
      query: vi.fn(async () => [
        { id: 1, artworks: [{ image_id: 'art1' }], screenshots: [{ image_id: 'shot1' }], genres: [{ name: 'Shooter' }] },
        { id: 2, screenshots: [{ image_id: 'shot2' }] },
      ]) as IgdbClient['query'],
    };
    const service = createRecommendationsService({ repo, igdb: igdbArt, adult: adultFilter(), cache: new MemoryCache() });
    const entries = (await service.board('a', 'hide')).entries;
    const byId = new Map(entries.map((e) => [e.game.id, e]));
    expect(byId.get(1)).toMatchObject({ artwork: expect.stringContaining('t_1080p/art1.jpg'), genres: ['Shooter'] });
    expect(byId.get(2)?.artwork).toContain('t_1080p/shot2.jpg');
    expect(byId.get(3)).toMatchObject({ artwork: null, genres: [] });
  });

  it('sem banco, explica o problema', async () => {
    const service = createRecommendationsService({ repo: null, igdb, adult: adultFilter() });
    await expect(service.board('a', 'hide')).rejects.toBeInstanceOf(MissingConfigError);
  });
});
