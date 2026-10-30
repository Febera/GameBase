import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import type { IgdbClient } from '../src/clients/igdb.js';
import type { ItadClient } from '../src/clients/itad.js';
import { MissingConfigError, UpstreamError } from '../src/lib/errors.js';
import { buildSearchQuery } from '../src/services/searchQuery.js';
import { createSearchService, normalizeFilters, STORES } from '../src/services/searchService.js';
import { adultFilter, lookupStub, steamApp, steamSyncStub } from './stubs.js';

const ctx = { nowS: 1_800_000_000, storeSourceIds: [], sourceField: 'external_game_source' };

describe('buildSearchQuery', () => {
  it('sem texto, ordena por popularidade e filtra PC', () => {
    const q = buildSearchQuery({}, ctx);
    expect(q.search).toBeNull();
    expect(q.sort).toBe('total_rating_count desc');
    expect(q.where).toContain('(platforms = (6) | external_games.external_game_source = 1)');
  });

  it('com texto e relevância usa search; com outra ordem usa nome parecido', () => {
    expect(buildSearchQuery({ q: 'portal' }, ctx)).toMatchObject({ search: 'portal', sort: null });
    const byRating = buildSearchQuery({ q: 'por"tal', sort: 'rating' }, ctx);
    expect(byRating.search).toBeNull();
    expect(byRating.where).toContain('name ~ *"por\\"tal"*');
    expect(byRating.where).toContain('total_rating_count >= 5');
    expect(byRating.sort).toBe('total_rating_count desc');
  });

  it('jogadores: coop, qualquer online e sem informação', () => {
    expect(buildSearchQuery({ players: 4, mode: 'coop' }, ctx).where).toContain(
      'multiplayer_modes.onlinecoopmax >= 4',
    );
    expect(buildSearchQuery({ players: 6 }, ctx).where).toContain(
      '(multiplayer_modes.onlinemax >= 6 | multiplayer_modes.onlinecoopmax >= 6)',
    );
    expect(buildSearchQuery({ players: 4, mode: 'coop', unknownPlayers: true }, ctx).where).toContain(
      '(multiplayer_modes.onlinecoopmax >= 4 | multiplayer_modes = null)',
    );
    expect(buildSearchQuery({ players: 1 }, ctx).where).not.toContain('multiplayer');
  });

  it('gêneros, anos, nota, lojas e lançamentos', () => {
    const where = buildSearchQuery(
      { genres: [5, 12], yearMin: 2020, yearMax: 2024, ratingMin: 80, sort: 'recent' },
      { ...ctx, storeSourceIds: [1, 26] },
    ).where;
    expect(where).toContain('genres = (5,12)');
    expect(where).toContain(`first_release_date >= ${Date.UTC(2020, 0, 1) / 1000}`);
    expect(where).toContain(`first_release_date < ${Date.UTC(2025, 0, 1) / 1000}`);
    expect(where).toContain('total_rating >= 80');
    expect(where).toContain('external_games.external_game_source = (1,26)');
    expect(where).toContain(`first_release_date <= ${ctx.nowS}`);
  });
});

function igdbWith(count: number, sources: { id: number; name: string }[] | 'fail' = []) {
  const bodies: string[] = [];
  const igdb: IgdbClient = {
    query: vi.fn(async (endpoint: string, body: string) => {
      bodies.push(`${endpoint}: ${body}`);
      if (endpoint === 'external_game_sources') {
        if (sources === 'fail') throw new UpstreamError('igdb', 404, 'não existe');
        return sources;
      }
      if (endpoint === 'genres') return [{ id: 5, name: 'Shooter' }];
      return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Jogo ${i + 1}`,
        slug: `j${i + 1}`,
        cover: { image_id: `c${i + 1}` },
        screenshots: [{ image_id: `s${i + 1}` }],
        genres: [{ name: 'Shooter' }],
        multiplayer_modes: [{ platform: 6, onlinecoopmax: 4 }],
      }));
    }) as IgdbClient['query'],
  };
  return { igdb, bodies };
}

const lookup = lookupStub({ steamAppIdsFor: async (ids) => new Map(ids.map((id) => [id, 1000 + id])) });

describe('searchService', () => {
  it('pagina a janela, tira adultos e acrescenta preço da Steam', async () => {
    const { igdb } = igdbWith(30);
    const service = createSearchService({
      igdb,
      cache: new MemoryCache(),
      adult: adultFilter([1]),
      lookup,
      steam: steamSyncStub([steamApp(1002, { isFree: true, price: null }), steamApp(1003, { adultContent: true })]),
    });
    const page = await service.search({}, 0, 10, 'hide');
    expect(page.items[0]).toMatchObject({ id: 2, free: true, genres: ['Shooter'], players: { onlineCoopMax: 4 } });
    expect(page.items[0]?.artwork).toContain('t_screenshot_med/s2.jpg');
    expect(page.items.map((r) => r.id)).not.toContain(3); // adulto na Steam
    expect(page.total).toBe(28);
    expect(page.pending).toBeUndefined();
  });

  it('faixas de preço usam a Steam e informam os pendentes', async () => {
    const { igdb } = igdbWith(5);
    const service = createSearchService({
      igdb,
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup,
      steam: steamSyncStub([
        steamApp(1001, { isFree: true, price: null }),
        steamApp(1002, { hasDemo: true }),
        steamApp(1003),
      ]),
    });
    expect((await service.search({ prices: ['free'] }, 0, 10, 'hide')).items.map((r) => r.id)).toEqual([1]);
    const freeOrDemo = await service.search({ prices: ['free', 'demo'] }, 0, 10, 'hide');
    expect(freeOrDemo.items.map((r) => r.id)).toEqual([1, 2]);
    expect(freeOrDemo.pending).toBe(2);
    expect((await service.search({ prices: ['paid'] }, 0, 10, 'hide')).items.map((r) => r.id)).toEqual([3]);
    // Todas as faixas = sem filtro: inclui os que não têm dados da Steam.
    const all = await service.search({ prices: ['free', 'demo', 'paid'] }, 0, 10, 'hide');
    expect(all.items).toHaveLength(5);
    expect(all.pending).toBeUndefined();
  });

  it('"mais bem avaliados" usa média bayesiana da Steam, com mínimo de 500 avaliações', async () => {
    const { igdb } = igdbWith(5);
    const service = createSearchService({
      igdb,
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup,
      steam: steamSyncStub([
        steamApp(1001, { reviews: { percent: 99, total: 520 } }), // nota alta, poucas avaliações
        steamApp(1002, { reviews: { percent: 95, total: 80_000 }, hasDemo: true }),
        steamApp(1003, { reviews: { percent: 100, total: 120 } }), // abaixo do mínimo: fora
        steamApp(1004, { reviews: { percent: 70, total: 40_000 } }),
      ]),
    });
    const page = await service.search({ sort: 'rating' }, 0, 10, 'hide');
    expect(page.items.map((r) => r.id)).toEqual([2, 1, 4]);
    expect(page.items[0]?.hasDemo).toBe(true);
    expect(page.items[1]?.hasDemo).toBe(false);
    expect(page.pending).toBe(1); // o 5º ainda não tem dados da Steam
  });

  it('"mais bem avaliados" soma os candidatos do ranking do banco, com os mesmos filtros', async () => {
    const { igdb, bodies } = igdbWith(3);
    const service = createSearchService({
      igdb,
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup,
      steam: steamSyncStub([1, 2, 3].map((i) => steamApp(1000 + i, { reviews: { percent: 90, total: 1000 * i } }))),
      topRatedIgdbIds: async () => [7, 8],
    });
    await service.search({ sort: 'rating', genres: [5] }, 0, 10, 'hide');
    const extra = bodies.find((b) => b.includes('id = (7,8)'));
    expect(extra).toContain('genres = (5)');
    // Sem "nota", o banco não é consultado.
    bodies.length = 0;
    await service.search({ sort: 'popular' }, 0, 10, 'hide');
    expect(bodies.some((b) => b.includes('id = ('))).toBe(false);
  });

  it('todas as opções marcadas equivalem a nenhuma', () => {
    expect(normalizeFilters({ prices: ['paid', 'free', 'demo'], stores: STORES.map((s) => s.key) })).toMatchObject({
      prices: [],
      stores: [],
    });
    expect(normalizeFilters({ prices: ['free'], stores: ['gog'] })).toMatchObject({ prices: ['free'], stores: ['gog'] });
  });

  it('filtro de preço sem banco explica o problema', async () => {
    const service = createSearchService({
      igdb: igdbWith(3).igdb,
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup,
      steam: null,
    });
    await expect(service.search({ prices: ['demo'] }, 0, 10, 'hide')).rejects.toBeInstanceOf(MissingConfigError);
    expect((await service.search({}, 0, 10, 'hide')).items).toHaveLength(3);
  });

  it('resolve lojas pelo nome da fonte e cai para IDs conhecidos', async () => {
    const named = igdbWith(1, [
      { id: 1, name: 'Steam' },
      { id: 26, name: 'Epic Game Store' },
      { id: 30, name: 'Itch.io' },
    ]);
    const service = createSearchService({ igdb: named.igdb, cache: new MemoryCache(), adult: adultFilter(), lookup, steam: null });
    await service.search({ stores: ['epic', 'itch'] }, 0, 10, 'hide');
    expect(named.bodies.find((b) => b.startsWith('games:'))).toContain('external_games.external_game_source = (26,30)');

    const fallback = igdbWith(1, 'fail');
    const old = createSearchService({ igdb: fallback.igdb, cache: new MemoryCache(), adult: adultFilter(), lookup, steam: null });
    await old.search({ stores: ['steam'] }, 0, 10, 'hide');
    expect(fallback.bodies.find((b) => b.startsWith('games:'))).toContain('external_games.category = (1)');
    // Loja sem ID conhecido: nenhum resultado, sem consultar jogos.
    expect((await old.search({ stores: ['itch'] }, 0, 10, 'hide')).items).toEqual([]);
  });

  it('autocomplete exige 2 letras e respeita o filtro adulto', async () => {
    const { igdb } = igdbWith(10);
    const service = createSearchService({ igdb, cache: new MemoryCache(), adult: adultFilter([1]), lookup, steam: null });
    expect(await service.suggest('p', 'hide')).toEqual([]);
    const list = await service.suggest('po', 'hide');
    expect(list).toHaveLength(6);
    expect(list[0]).toMatchObject({ id: 2, name: 'Jogo 2' });
    expect(list[0]?.cover).toContain('t_cover_small');
  });

  it('facetas trazem gêneros e lojas', async () => {
    const service = createSearchService({ igdb: igdbWith(0).igdb, cache: new MemoryCache(), adult: adultFilter(), lookup, steam: null });
    const facets = await service.facets();
    expect(facets.genres).toEqual([{ id: 5, name: 'Shooter' }]);
    expect(facets.stores.map((s) => s.key)).toContain('itch');
  });
});

describe('searchService: duplicatas e validade da promoção', () => {
  function igdbNamed(names: string[]): IgdbClient {
    return {
      query: vi.fn(async () =>
        names.map((name, i) => ({ id: i + 1, name, slug: `s${i}`, cover: { image_id: `c${i}` } })),
      ) as IgdbClient['query'],
    };
  }

  it('esconde registros repetidos, a menos que peçam para mostrar', async () => {
    const service = createSearchService({
      igdb: igdbNamed(['Overwatch', 'Overwatch', 'Outro']),
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup,
      steam: null,
    });
    expect((await service.search({ q: 'over' }, 0, 10, 'hide')).items).toHaveLength(2);
    expect((await service.search({ q: 'over', showDuplicates: true }, 0, 10, 'hide')).items).toHaveLength(3);
  });

  it('busca o fim da promoção da Steam na ITAD, só para quem está em promoção', async () => {
    const itad = {
      configured: true,
      itadIdsForSteam: vi.fn(async (ids: number[]) => Object.fromEntries(ids.map((id) => [`app/${id}`, `itad-${id}`]))),
      prices: vi.fn(async (ids: string[]) =>
        ids.map((id) => ({
          id,
          deals: [{ shop: { id: 61, name: 'Steam' }, price: { amount: 1, currency: 'BRL' }, regular: { amount: 2, currency: 'BRL' }, cut: 50, expiry: '2026-10-31T19:00:00+02:00', url: 'x' }],
        })),
      ),
    } as unknown as ItadClient;
    const service = createSearchService({
      igdb: igdbNamed(['Em Promoção', 'Preço Cheio']),
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup,
      steam: steamSyncStub([
        steamApp(1001, { price: { currency: 'BRL', initial: 200, final: 100, discountPercent: 50 } }),
        steamApp(1002),
      ]),
      itad,
    });
    const page = await service.search({}, 0, 10, 'hide');
    expect(page.items.map((r) => r.promoEndsAt)).toEqual(['2026-10-31', null]);
    expect(itad.itadIdsForSteam).toHaveBeenCalledWith([1001]);
    // Segunda vez vem do cache.
    await service.search({}, 0, 10, 'hide');
    expect(itad.itadIdsForSteam).toHaveBeenCalledTimes(1);
  });
});
