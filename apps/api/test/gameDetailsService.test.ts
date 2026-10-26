import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import type { IgdbClient } from '../src/clients/igdb.js';
import type { ItadClient } from '../src/clients/itad.js';
import { AdultContentError, NotFoundError } from '../src/lib/errors.js';
import {
  createGameDetailsService,
  type IgdbGameFull,
  playerCounts,
  yearLowFrom,
} from '../src/services/gameDetailsService.js';
import { storeLinksFrom } from '../src/services/storeLinks.js';
import { adultFilter, lookupStub, steamApp, steamSyncStub } from './stubs.js';

const fullGame: IgdbGameFull = {
  id: 100,
  name: 'Jogo Coop',
  slug: 'jogo-coop',
  cover: { image_id: 'capa' },
  first_release_date: 1_790_000_000,
  total_rating: 87.4,
  total_rating_count: 120,
  aggregated_rating: 90.2,
  summary: 'Resumo',
  artworks: [{ image_id: 'arte' }],
  screenshots: [{ image_id: 's1' }, { image_id: 's2' }],
  videos: [{ video_id: 'yt123', name: 'Trailer' }],
  genres: [{ name: 'Shooter' }],
  game_modes: [{ name: 'Co-operative' }],
  involved_companies: [
    { developer: true, company: { name: 'Estúdio' } },
    { publisher: true, company: { name: 'Editora' } },
  ],
  websites: [{ url: 'https://store.steampowered.com/app/555/x/' }, { url: 'https://example.com' }],
  similar_games: [3, 1, 2],
  multiplayer_modes: [{ platform: 6, onlinemax: 8, onlinecoopmax: 4 }, { platform: 48, onlinemax: 16 }],
};

function igdbFor(game: IgdbGameFull | null): IgdbClient {
  return {
    query: vi.fn(async (_endpoint: string, body: string) => {
      if (body.includes('where id = 100;') || body.includes('where id = 999;')) return game ? [game] : [];
      // similares: devolve fora de ordem para testar a ordenação
      return [1, 2, 3].map((id) => ({ id, name: `Similar ${id}`, slug: `s${id}`, cover: { image_id: `c${id}` } }));
    }) as IgdbClient['query'],
  };
}

function itadWithPrices(mature = false): ItadClient {
  return {
    configured: true,
    deals: vi.fn(),
    itadIdsForSteam: vi.fn(async () => ({})),
    steamIdsFor: vi.fn(),
    lookupByTitle: vi.fn(async () => ({ found: false, id: null, mature: false })),
    lookupBySteamAppId: vi.fn(async () => ({ found: true, id: 'itad-1', mature })),
    gameInfo: vi.fn(async () => ({
      reviews: [
        { score: 87, source: 'Metascore', count: 30, url: 'https://meta' },
        { score: 92, source: 'Steam', count: 15000, url: 'https://steam/reviews' },
      ],
    })),
    historyLow: vi.fn(async () => [
      {
        id: 'itad-1',
        low: {
          shop: { id: 50, name: 'Nuuvem' },
          price: { amount: 9.9, currency: 'BRL' },
          regular: { amount: 59.9, currency: 'BRL' },
          cut: 83,
          timestamp: '2025-11-27T21:33:36+01:00',
        },
      },
    ]),
    history: vi.fn(async () => [
      { timestamp: '2026-07-01T10:00:00+02:00', shop: { id: 61, name: 'Steam' }, deal: { price: { amount: 29.95, currency: 'BRL' }, regular: { amount: 59.9, currency: 'BRL' }, cut: 50 } },
      { timestamp: '2026-03-01T10:00:00+02:00', shop: { id: 50, name: 'Nuuvem' }, deal: { price: { amount: 29.95, currency: 'BRL' }, regular: { amount: 59.9, currency: 'BRL' }, cut: 50 } },
    ]),
    prices: vi.fn(async () => [
      {
        id: 'itad-1',
        historyLow: { all: { amount: 9.9, currency: 'BRL' }, y1: { amount: 29.95, currency: 'BRL' } },
        deals: [
          { shop: { id: 61, name: 'Steam' }, price: { amount: 59.9, currency: 'BRL' }, regular: { amount: 59.9, currency: 'BRL' }, cut: 0, drm: [{ id: 61, name: 'Steam' }], url: 'https://itad/steam' },
          { shop: { id: 50, name: 'Nuuvem' }, price: { amount: 41.93, currency: 'BRL' }, regular: { amount: 59.9, currency: 'BRL' }, cut: 30, url: 'https://itad/nuuvem' },
        ],
      },
    ]),
  };
}

const deps = (overrides = {}) => ({
  igdb: igdbFor(fullGame),
  lookup: lookupStub({ steamAppIdsFor: async () => new Map([[100, 555], [1, 501], [2, 502]]) }),
  adult: adultFilter(),
  itad: itadWithPrices(),
  steam: steamSyncStub([
    steamApp(555, { hasDemo: true }),
    steamApp(501, { isFree: true, price: null }),
    steamApp(502, { adultContent: true }),
  ]),
  cache: new MemoryCache(),
  ...overrides,
});

describe('playerCounts', () => {
  it('usa os modos de PC quando existem', () => {
    expect(playerCounts(fullGame.multiplayer_modes)).toEqual({
      onlineMax: 8,
      onlineCoopMax: 4,
      offlineMax: null,
      offlineCoopMax: null,
    });
  });
  it('usa todos os modos quando nenhum é de PC, e null sem números', () => {
    expect(playerCounts([{ platform: 48, offlinemax: 2 }])?.offlineMax).toBe(2);
    expect(playerCounts([{ platform: 6 }])).toBeNull();
    expect(playerCounts(undefined)).toBeNull();
  });
});

describe('yearLowFrom', () => {
  it('sem ocorrência no histórico, mantém o valor e deixa a data desconhecida', () => {
    expect(yearLowFrom({ amount: 10, currency: 'BRL' }, [])).toEqual({
      price: { amount: 10, currency: 'BRL' },
      shop: null,
      date: null,
    });
    expect(yearLowFrom(null, [])).toBeNull();
  });
});

describe('storeLinksFrom', () => {
  it('reconhece lojas pelo endereço e ignora o resto', () => {
    expect(
      storeLinksFrom([
        'https://example.com',
        'https://steamcommunity.com/app/1',
        'https://store.steampowered.com/app/1',
        'https://www.gog.com/game/x',
        'https://dev.itch.io/jogo',
      ]),
    ).toEqual([
      { store: 'Steam', url: 'https://store.steampowered.com/app/1' },
      { store: 'GOG', url: 'https://www.gog.com/game/x' },
      { store: 'itch.io', url: 'https://dev.itch.io/jogo' },
    ]);
  });
});

describe('gameDetailsService', () => {
  it('monta a página com mídia, jogadores, Steam, preços e similares em ordem', async () => {
    const game = await createGameDetailsService(deps()).getGame(100, 'hide');

    expect(game).toMatchObject({
      name: 'Jogo Coop',
      rating: 87,
      criticRating: 90,
      genres: ['Shooter'],
      developers: ['Estúdio'],
      publishers: ['Editora'],
      players: { onlineMax: 8, onlineCoopMax: 4 },
      videos: [{ youtubeId: 'yt123', name: 'Trailer' }],
      steam: { appId: 555, hasDemo: true, free: false },
      historyLow: { price: { amount: 9.9, currency: 'BRL' }, shop: 'Nuuvem', date: '2025-11-27' },
      yearLow: { price: { amount: 29.95, currency: 'BRL' }, shop: 'Steam', date: '2026-07-01' },
      steamReviews: { percent: 92, count: 15000, url: 'https://steam/reviews' },
    });
    expect(game.heroImage).toContain('t_1080p/arte.jpg');
    expect(game.screenshots[0]?.thumb).toContain('t_screenshot_med/s1.jpg');
    expect(game.offers.map((o) => o.shop)).toEqual(['Nuuvem', 'Steam']);
    expect(game.offers[1]?.drm).toEqual(['Steam']);
    expect(game.storeLinks).toEqual([{ store: 'Steam', url: 'https://store.steampowered.com/app/555/x/' }]);
    // O 2 é adulto na Steam e some; o 1 ganha "grátis" pelos dados da Steam.
    expect(game.similar.map((s) => s.id)).toEqual([3, 1]);
    expect(game.similar[1]).toMatchObject({ free: true, price: null });
  });

  it('esconde similares adultos e bloqueia a página adulta com o filtro ligado', async () => {
    const service = createGameDetailsService(deps({ adult: adultFilter([1]) }));
    expect((await service.getGame(100, 'hide')).similar.map((s) => s.id)).toEqual([3]);
    expect((await service.getGame(100, 'show')).similar.map((s) => s.id)).toEqual([3, 1, 2]);

    const adultPage = createGameDetailsService(deps({ adult: adultFilter([100]) }));
    await expect(adultPage.getGame(100, 'hide')).rejects.toBeInstanceOf(AdultContentError);
    expect((await adultPage.getGame(100, 'show')).name).toBe('Jogo Coop');
  });

  it('bloqueia também pelas marcações da Steam e da ITAD', async () => {
    const steamAdult = createGameDetailsService(deps({ steam: steamSyncStub([steamApp(555, { adultContent: true })]) }));
    await expect(steamAdult.getGame(100, 'hide')).rejects.toBeInstanceOf(AdultContentError);

    const itadAdult = createGameDetailsService(deps({ itad: itadWithPrices(true) }));
    await expect(itadAdult.getGame(100, 'hide')).rejects.toBeInstanceOf(AdultContentError);
  });

  it('funciona sem chave da ITAD e sem banco', async () => {
    const game = await createGameDetailsService(
      deps({ itad: { ...itadWithPrices(), configured: false }, steam: null }),
    ).getGame(100, 'hide');
    expect(game.offers).toEqual([]);
    expect(game.steam).toMatchObject({ appId: 555, free: null, hasDemo: null, price: null });
  });

  it('responde 404 para jogo inexistente', async () => {
    await expect(createGameDetailsService(deps({ igdb: igdbFor(null) })).getGame(999, 'hide')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
