import type { DealCard } from '@rj/shared';
import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import type { GamerPowerClient, RawGiveaway } from '../src/clients/gamerpower.js';
import type { ItadClient } from '../src/clients/itad.js';
import type { DealsService } from '../src/services/dealsService.js';
import {
  cleanGiveawayTitle,
  createGiveawaysService,
  parseEndDate,
  storeName,
} from '../src/services/giveawaysService.js';
import type { IgdbGame } from '../src/services/igdbMappers.js';
import type { ListEntry } from '../src/services/listing.js';
import { adultFilter, lookupStub, stubDeals } from './stubs.js';

function raw(id: number, title: string, extra: Partial<RawGiveaway> = {}): RawGiveaway {
  return {
    id,
    title,
    worth: '$19.99',
    thumbnail: `thumb${id}.jpg`,
    image: `img${id}.jpg`,
    open_giveaway_url: `https://gp/open/${id}`,
    gamerpower_url: `https://gp/${id}`,
    type: 'Game',
    platforms: 'PC, Epic Games Store',
    end_date: '2026-10-30 23:59:00',
    status: 'Active',
    users: 100,
    ...extra,
  };
}

const igdbGame = (id: number, name: string): IgdbGame => ({ id, name, slug: name, cover: { image_id: `c${id}` } });

function itadStub(mature: Record<string, boolean>, configured = true): ItadClient {
  return {
    configured,
    deals: vi.fn(),
    itadIdsForSteam: vi.fn(async () => ({})),
    steamIdsFor: vi.fn(),
    lookupByTitle: vi.fn(async (title: string) => ({ found: title in mature, id: title in mature ? `itad-${title}` : null, mature: mature[title] ?? false })),
    lookupBySteamAppId: vi.fn(),
    gameInfo: vi.fn(),
    historyLow: vi.fn(),
    history: vi.fn(),
    prices: vi.fn(),
  };
}

function freeDeal(id: string, title: string, regular: number, extra: Partial<DealCard> = {}): ListEntry<DealCard> {
  return {
    adult: false,
    steamAppId: null,
    igdbCount: 0,
    item: {
      id,
      title,
      cover: null,
      boxart: `box-${id}.jpg`,
      igdbId: null,
      shop: 'Steam',
      price: { amount: 0, currency: 'BRL' },
      regular: { amount: regular, currency: 'BRL' },
      cut: 100,
      rating: null,
      releaseDate: null,
      reviewCount: null,
      expiry: '2026-11-05T19:00:00+01:00',
      url: `https://itad.link/${id}`,
      ...extra,
    },
  };
}

describe('títulos do GamerPower', () => {
  it('limpa loja e sufixos', () => {
    expect(cleanGiveawayTitle('Hogwarts Legacy (Epic Games) Giveaway')).toBe('Hogwarts Legacy');
    expect(cleanGiveawayTitle('Free Ruiner (Steam) Giveaway')).toBe('Ruiner');
    expect(cleanGiveawayTitle('Tunic (GOG) Giveaway')).toBe('Tunic');
    expect(cleanGiveawayTitle('Celeste - Free on Steam')).toBe('Celeste');
  });

  it('extrai loja e data', () => {
    expect(storeName('PC, Epic Games Store')).toBe('Epic Games Store');
    expect(storeName('PC')).toBe('PC');
    expect(parseEndDate('2026-10-30 23:59:00')).toBe('2026-10-30');
    expect(parseEndDate('2026-11-05T19:00:00+01:00')).toBe('2026-11-05');
    expect(parseEndDate('N/A')).toBeNull();
    expect(parseEndDate(null)).toBeNull();
  });
});

describe('giveawaysService', () => {
  const gamerpower: GamerPowerClient = {
    pcGameGiveaways: async () => [
      raw(1, 'Tunic (Epic Games) Giveaway'),
      raw(2, 'Jogo Adulto IGDB Giveaway'),
      raw(3, 'Desconhecido Adulto Giveaway'),
      raw(4, 'Desconhecido Limpo Giveaway', { worth: 'N/A', end_date: 'N/A' }),
      raw(5, 'Pacote de skins', { type: 'Loot' }),
    ],
  };
  const lookup = lookupStub({
    byTitles: async () =>
      new Map([
        ['tunic', igdbGame(10, 'TUNIC')],
        ['jogo adulto igdb', igdbGame(20, 'Jogo Adulto IGDB')],
      ]),
  });

  it('associa capas, filtra adultos pelas duas fontes e ignora o que não é jogo', async () => {
    const service = createGiveawaysService({
      gamerpower,
      deals: stubDeals,
      lookup,
      adult: adultFilter([20]),
      itad: itadStub({ 'Desconhecido Adulto': true, 'Desconhecido Limpo': false }),
      cache: new MemoryCache(),
    });

    const hidden = await service.getGiveaways(0, 10, 'hide');
    expect(hidden.items.map((g) => g.id)).toEqual(['gp-1', 'gp-4']);
    expect(hidden.items[0]).toMatchObject({ title: 'TUNIC', store: 'Epic Games Store', endDate: '2026-10-30' });
    expect(hidden.items[0]?.cover?.url).toContain('c10.jpg');
    expect(hidden.items[1]).toMatchObject({ cover: null, image: 'img4.jpg', worth: null, endDate: null });

    const shown = await service.getGiveaways(0, 10, 'show');
    expect(shown.items.map((g) => g.id)).toEqual(['gp-1', 'gp-2', 'gp-3', 'gp-4']);
  });

  it('põe os jogos pagos com 100% de desconto primeiro e não repete o mesmo jogo', async () => {
    const deals: DealsService = {
      getDeals: vi.fn(),
      getFreeDeals: async () => [freeDeal('caro', 'Grande Jogo', 199.9), freeDeal('tun', 'Tunic', 79.9)],
    };
    const service = createGiveawaysService({
      gamerpower,
      deals,
      lookup,
      adult: adultFilter([20]),
      itad: itadStub({ 'Desconhecido Adulto': true }),
      cache: new MemoryCache(),
    });
    const page = await service.getGiveaways(0, 10, 'hide');
    expect(page.items.map((g) => g.id)).toEqual(['itad-caro', 'itad-tun', 'gp-4']);
    expect(page.items[0]).toMatchObject({
      regular: { amount: 199.9, currency: 'BRL' },
      endDate: '2026-11-05',
      image: 'box-caro.jpg',
    });
  });

  it('segue só com o GamerPower sem a chave da ITAD ou se a IGDB falhar', async () => {
    const service = createGiveawaysService({
      gamerpower,
      deals: { getDeals: vi.fn(), getFreeDeals: vi.fn() },
      lookup: lookupStub({ byTitles: async () => Promise.reject(new Error('fora do ar')) }),
      adult: adultFilter(),
      itad: itadStub({}, false),
      cache: new MemoryCache(),
    });
    const page = await service.getGiveaways(0, 10, 'hide');
    expect(page.items).toHaveLength(4);
    expect(page.items.every((g) => g.cover === null)).toBe(true);
  });
});

describe('giveawaysService: páginas internas e resgate', () => {
  it('liga giveaways sem IGDB à página da oferta e encontra o resgate por jogo', async () => {
    const service = createGiveawaysService({
      gamerpower: { pcGameGiveaways: async () => [raw(1, 'Tunic (Epic Games) Giveaway'), raw(4, 'Desconhecido Limpo Giveaway')] },
      deals: stubDeals,
      lookup: lookupStub({ byTitles: async () => new Map([['tunic', igdbGame(10, 'TUNIC')]]) }),
      adult: adultFilter(),
      itad: itadStub({ 'Desconhecido Limpo': false }),
      cache: new MemoryCache(),
    });
    const page = await service.getGiveaways(0, 10, 'hide');
    expect(page.items.find((g) => g.id === 'gp-4')?.itadId).toBe('itad-Desconhecido Limpo');
    expect(await service.findFor({ igdbId: 10 }, 'hide')).toMatchObject({ store: 'Epic Games Store', url: 'https://gp/open/1' });
    expect(await service.findFor({ itadId: 'itad-Desconhecido Limpo' }, 'hide')).toMatchObject({ url: 'https://gp/open/4' });
    expect(await service.findFor({ igdbId: 999 }, 'hide')).toBeNull();
  });
});
