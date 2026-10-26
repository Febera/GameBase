import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import type { DealsQuery, ItadClient, ItadDealItem } from '../src/clients/itad.js';
import { createDealsService } from '../src/services/dealsService.js';
import { adultFilter, lookupStub, steamApp, steamSyncStub } from './stubs.js';

function deal(id: string, cut: number, extra: Partial<ItadDealItem> = {}, regular = 50): ItadDealItem {
  return {
    id,
    slug: id,
    title: `Jogo ${id}`,
    type: 'game',
    mature: false,
    assets: { boxart: `box-${id}.jpg` },
    deal: {
      shop: { id: 61, name: 'Steam' },
      price: { amount: cut === 100 ? 0 : 5, currency: 'BRL' },
      regular: { amount: regular, currency: 'BRL' },
      cut,
      expiry: null,
      url: `https://itad.link/${id}`,
    },
    ...extra,
  };
}

/** ITAD falsa que respeita a faixa de desconto pedida. */
function itadWith(list: ItadDealItem[], steam: Record<string, string[] | null> = {}) {
  const deals = vi.fn(async (q: DealsQuery) => ({
    nextOffset: 0,
    hasMore: false,
    list: list.filter((d) => d.deal.cut >= q.minCut && d.deal.cut <= q.maxCut),
  }));
  const client: ItadClient = {
    configured: true,
    deals,
    itadIdsForSteam: vi.fn(async () => ({})),
    steamIdsFor: vi.fn(async () => steam),
    lookupByTitle: vi.fn(),
    lookupBySteamAppId: vi.fn(),
    gameInfo: vi.fn(),
    historyLow: vi.fn(),
    history: vi.fn(),
    prices: vi.fn(),
  };
  return { client, deals };
}

const lookup = lookupStub({
  bySteamAppIds: async (ids) =>
    new Map(
      ids.map((appId) => [
        appId,
        { id: Number(appId), name: `IGDB ${appId}`, slug: appId, cover: { image_id: `c${appId}` }, total_rating: Number(appId) },
      ]),
    ),
});

describe('dealsService', () => {
  it('mantém só jogos de 70% a 99% e ordena por desconto e depois por nota', async () => {
    const { client, deals } = itadWith(
      [deal('a', 80), deal('b', 90), deal('c', 80), deal('dlc', 95, { type: 'dlc' }), deal('gratis', 100), deal('setenta', 70), deal('pouco', 69)],
      { a: ['app/70'], c: ['sub/1', 'app/85'] },
    );
    const service = createDealsService({ itad: client, lookup, adult: adultFilter(), cache: new MemoryCache() });
    const page = await service.getDeals(0, 10, 'hide');

    expect(page.items.map((d) => d.id)).toEqual(['b', 'c', 'a', 'setenta']);
    expect(page.items[1]).toMatchObject({ igdbId: 85, rating: 85 });
    expect(page.items[0]).toMatchObject({ igdbId: null, rating: null, boxart: 'box-b.jpg' });
    expect(deals.mock.calls[0]?.[0]).toMatchObject({ minCut: 70, maxCut: 99 });
  });

  it('lista os de 100% do preço original mais alto para o mais baixo', async () => {
    const { client, deals } = itadWith([deal('barato', 100, {}, 20), deal('caro', 100, {}, 200), deal('x', 80)]);
    const service = createDealsService({ itad: client, lookup, adult: adultFilter(), cache: new MemoryCache() });
    const free = await service.getFreeDeals('hide');
    expect(free.map((f) => f.item.id)).toEqual(['caro', 'barato']);
    expect(deals.mock.calls[0]?.[0]).toMatchObject({ minCut: 100, maxCut: 100 });
  });

  it('pede jogos adultos à ITAD só quando o filtro está desligado e usa caches separados', async () => {
    const { client, deals } = itadWith([deal('a', 80, { mature: true }), deal('b', 80)], { b: ['app/9'] });
    const service = createDealsService({ itad: client, lookup, adult: adultFilter([9]), cache: new MemoryCache() });

    expect((await service.getDeals(0, 10, 'hide')).items).toHaveLength(0);
    expect((await service.getDeals(0, 10, 'show')).items).toHaveLength(2);
    expect(deals.mock.calls.map((call) => call[0].mature)).toEqual([false, true]);
  });

  it('mostra as ofertas mesmo se o cruzamento com a IGDB falhar', async () => {
    const { client } = itadWith([deal('a', 80)]);
    client.steamIdsFor = vi.fn(async () => Promise.reject(new Error('falhou')));
    const log = vi.fn();
    const service = createDealsService({ itad: client, lookup, adult: adultFilter(), cache: new MemoryCache(), log });
    expect((await service.getDeals(0, 10, 'hide')).items).toHaveLength(1);
    expect(log).toHaveBeenCalledOnce();
  });
});

describe('dealsService: avaliações e ordenação', () => {
  it('usa o total de avaliações da Steam, com a IGDB como reserva, e pede a verificação na fila lenta', async () => {
    const { client } = itadWith([deal('a', 80), deal('b', 90), deal('c', 75)], {
      a: ['app/1'],
      b: ['app/2'],
      c: ['app/3'],
    });
    const steam = steamSyncStub([steamApp(1, { reviews: { total: 50, percent: 90 } }), steamApp(2, { reviews: { total: 4000, percent: 80 } })]);
    const refresh = vi.spyOn(steam, 'refresh');
    const lookupWithCounts = lookupStub({
      bySteamAppIds: async (ids) =>
        new Map(ids.map((appId) => [appId, { id: Number(appId), name: appId, slug: appId, total_rating_count: 200 }])),
    });
    const service = createDealsService({ itad: client, lookup: lookupWithCounts, adult: adultFilter(), cache: new MemoryCache(), steam });

    const page = await service.getDeals(0, 10, 'hide');
    expect(page.items.map((d) => [d.id, d.reviewCount])).toEqual([
      ['b', 4000],
      ['c', 200],
      ['a', 50],
    ]);
    expect(refresh).toHaveBeenCalledWith(expect.arrayContaining([1, 2, 3]), 'low');
    expect((await service.getDeals(0, 10, 'hide', 'discount', 'asc')).items.map((d) => d.id)).toEqual(['c', 'a', 'b']);
  });
});
