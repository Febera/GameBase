import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import type { IgdbClient } from '../src/clients/igdb.js';
import { MissingConfigError } from '../src/lib/errors.js';
import { categorize, createGamesService, MAX_PER_LIST } from '../src/services/gamesService.js';
import type { IgdbGame } from '../src/services/igdbMappers.js';
import { fakeClock } from './helpers.js';
import { adultFilter, lookupStub, steamApp, steamSyncStub } from './stubs.js';

function game(id: number, extra: Partial<IgdbGame> = {}): IgdbGame {
  return { id, name: `Jogo ${id}`, slug: `jogo-${id}`, cover: { image_id: `img${id}` }, ...extra };
}

/** IGDB falsa: `count` jogos populares, ids 1..count, em ordem de visitas. */
function igdbWith(count: number): IgdbClient {
  const primitives = Array.from({ length: count }, (_, i) => ({ game_id: i + 1, value: 10_000 - i }));
  return {
    query: vi.fn(async (endpoint: string) =>
      endpoint === 'popularity_primitives' ? primitives : primitives.map((p) => game(p.game_id)),
    ) as IgdbClient['query'],
  };
}

describe('categorize', () => {
  it('separa grátis, com demo e pagos', () => {
    expect(categorize(steamApp(1, { isFree: true, hasDemo: true }))).toBe('free');
    expect(categorize(steamApp(1, { hasDemo: true }))).toBe('demo');
    expect(categorize(steamApp(1))).toBe('paid');
    expect(categorize(steamApp(1, { found: false }))).toBeNull();
  });
});

describe('gamesService.getNewPopular', () => {
  it('ordena pelos mais visitados e completa com lançamentos recentes', async () => {
    const calls: string[] = [];
    const igdb: IgdbClient = {
      query: vi.fn(async (endpoint: string, body: string) => {
        calls.push(`${endpoint}: ${body}`);
        if (endpoint === 'popularity_primitives') {
          return [
            { game_id: 1, value: 10 },
            { game_id: 2, value: 50 },
            { game_id: 3, value: 30 },
          ];
        }
        if (body.includes('where id = (')) return [game(1), game(2), game(3)];
        return [game(2), game(9, { total_rating_count: 1 }), game(8, { total_rating_count: 5 })];
      }) as IgdbClient['query'],
    };
    const service = createGamesService({
      igdb,
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup: lookupStub(),
      steam: null,
      now: fakeClock().now,
    });
    const page = await service.getNewPopular(0, 10, 'hide');
    expect(page.items.map((g) => g.id)).toEqual([2, 3, 1, 8, 9]);
    expect(calls[1]).toContain('platforms = (6)');
    expect(calls[1]).toContain('game_type = (0,4,8,9,10,11)');
  });

  it('divide pelos dados da Steam, com preço, e avisa quantos faltam verificar', async () => {
    // jogos 1..6 → app 101..106; o 6 ainda não foi buscado na Steam
    const steam = steamSyncStub([
      steamApp(101, { isFree: true, price: null }),
      steamApp(102, { hasDemo: true }),
      steamApp(103, { price: { currency: 'BRL', initial: 9990, final: 4995, discountPercent: 50 } }),
      steamApp(104, { adultContent: true }),
      steamApp(105, { found: false }),
    ]);
    const service = createGamesService({
      igdb: igdbWith(6),
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup: lookupStub({ steamAppIdsFor: async (ids) => new Map(ids.map((id) => [id, 100 + id])) }),
      steam,
    });

    const free = await service.getNewPopular(0, 20, 'hide', 'free');
    expect(free.items.map((g) => g.id)).toEqual([1]);
    expect(free.items[0]).toMatchObject({ free: true, price: null });
    expect(free.pending).toBe(1);

    expect((await service.getNewPopular(0, 20, 'hide', 'demo')).items.map((g) => g.id)).toEqual([2]);

    const paid = await service.getNewPopular(0, 20, 'hide', 'paid');
    expect(paid.items.map((g) => g.id)).toEqual([3]); // o 4 tem conteúdo adulto na Steam
    expect(paid.items[0]?.price).toEqual({
      current: { amount: 49.95, currency: 'BRL' },
      regular: { amount: 99.9, currency: 'BRL' },
      cut: 50,
    });
    expect((await service.getNewPopular(0, 20, 'show', 'paid')).items.map((g) => g.id)).toEqual([3, 4]);

    expect(steam.refreshed[0]).toEqual([101, 102, 103, 104, 105, 106]);
  });

  it('limita cada divisão e respeita a marca adulta da IGDB', async () => {
    const steam = steamSyncStub(Array.from({ length: 300 }, (_, i) => steamApp(i + 1)));
    const service = createGamesService({
      igdb: igdbWith(300),
      cache: new MemoryCache(),
      adult: adultFilter([1]),
      lookup: lookupStub({ steamAppIdsFor: async (ids) => new Map(ids.map((id) => [id, id])) }),
      steam,
    });
    const paid = await service.getNewPopular(0, 50, 'hide', 'paid');
    expect(paid.total).toBe(MAX_PER_LIST);
    expect(paid.items[0]?.id).toBe(2);
  });

  it('explica quando falta o banco', async () => {
    const service = createGamesService({
      igdb: igdbWith(3),
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup: lookupStub(),
      steam: null,
    });
    await expect(service.getNewPopular(0, 20, 'hide', 'free')).rejects.toBeInstanceOf(MissingConfigError);
  });
});

describe('gamesService: edições, sem preço e ordenação', () => {
  it('junta GTA V com a edição Enhanced, esconde pagos sem preço e ordena por avaliações', async () => {
    const names = ['Grand Theft Auto V', 'Grand Theft Auto V Enhanced', 'Jogo Sem Preço', 'Pequeno', 'Grande'];
    const igdb: IgdbClient = {
      query: vi.fn(async (endpoint: string) => {
        const list = names.map((name, i) => ({
          id: i + 1,
          name,
          slug: `s${i}`,
          cover: name.endsWith('Enhanced') ? undefined : { image_id: `c${i + 1}` },
        }));
        return endpoint === 'popularity_primitives' ? list.map((g, i) => ({ game_id: g.id, value: 100 - i })) : list;
      }) as IgdbClient['query'],
    };
    const steam = steamSyncStub([
      steamApp(101, { price: null, reviews: { total: 900000, percent: 85 } }),
      steamApp(102, { price: { currency: 'BRL', initial: 8000, final: 4000, discountPercent: 50 } }),
      steamApp(103, { price: null }),
      steamApp(104, { reviews: { total: 10, percent: 60 } }),
      steamApp(105, { reviews: { total: 5000, percent: 95 } }),
    ]);
    const service = createGamesService({
      igdb,
      cache: new MemoryCache(),
      adult: adultFilter(),
      lookup: lookupStub({ steamAppIdsFor: async (ids) => new Map(ids.map((id) => [id, 100 + id])) }),
      steam,
    });

    const paid = await service.getNewPopular(0, 20, 'hide', 'paid');
    expect(paid.items.map((g) => g.name)).toEqual(['Grand Theft Auto V', 'Grande', 'Pequeno']);
    expect(paid.items[0]).toMatchObject({ id: 1, reviewCount: 900000 });
    expect(paid.items[0]?.price?.cut).toBe(50); // preço emprestado da edição Enhanced
    expect(paid.items[0]?.cover?.url).toContain('c1');

    const byReleaseAsc = await service.getNewPopular(0, 20, 'hide', 'paid', 'reviews', 'asc');
    expect(byReleaseAsc.items.map((g) => g.name)).toEqual(['Pequeno', 'Grande', 'Grand Theft Auto V']);
  });
});
