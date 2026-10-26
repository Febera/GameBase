import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import type { ItadClient } from '../src/clients/itad.js';
import { AdultContentError, NotFoundError, UpstreamError } from '../src/lib/errors.js';
import { createItadPricing } from '../src/services/itadPricing.js';
import { createOfferService } from '../src/services/offerService.js';
import { adultFilter, lookupStub } from './stubs.js';

const ID = '018d937f-07fc-72ed-8517-d8e24cb1eb22';

function itad(info: Record<string, unknown> | 'missing'): ItadClient {
  return {
    configured: true,
    deals: vi.fn(),
    itadIdsForSteam: vi.fn(async () => ({})),
    steamIdsFor: vi.fn(),
    lookupByTitle: vi.fn(),
    lookupBySteamAppId: vi.fn(),
    gameInfo: vi.fn(async () => {
      if (info === 'missing') throw new UpstreamError('itad', 404, 'não existe');
      return info;
    }),
    historyLow: vi.fn(async () => []),
    history: vi.fn(async () => []),
    prices: vi.fn(async () => {
      if (info === 'missing') throw new UpstreamError('itad', 400, 'id inválido');
      return [
        {
          id: ID,
          historyLow: { all: { amount: 5, currency: 'BRL' } },
          deals: [
            { shop: { id: 50, name: 'Nuuvem' }, price: { amount: 9.99, currency: 'BRL' }, regular: { amount: 49.99, currency: 'BRL' }, cut: 80, url: 'https://x' },
          ],
        },
      ];
    }),
  };
}

function service(info: Record<string, unknown> | 'missing', igdbId?: number, adultIds: number[] = []) {
  const client = itad(info);
  return createOfferService({
    pricing: createItadPricing({ itad: client, cache: new MemoryCache() }),
    lookup: lookupStub({
      bySteamAppIds: async (ids) =>
        new Map(igdbId ? ids.map((id) => [id, { id: igdbId, name: 'X', slug: 'x' }]) : []),
    }),
    adult: adultFilter(adultIds),
  });
}

describe('página de oferta', () => {
  it('monta a oferta com preços, imagens e dados da ITAD', async () => {
    const offer = await service({
      title: 'Jogo Só na ITAD',
      appid: null,
      assets: { banner600: 'banner.jpg', boxart: 'box.jpg' },
      developers: [{ name: 'Estúdio' }],
      tags: ['Indie'],
      reviews: [{ score: 88, source: 'Steam', count: 300, url: 'https://r' }],
    }).getOffer(ID, 'hide');
    expect(offer).toMatchObject({
      title: 'Jogo Só na ITAD',
      banner: 'banner.jpg',
      boxart: 'box.jpg',
      igdbId: null,
      developers: ['Estúdio'],
      steamReviews: { percent: 88, count: 300 },
      historyLow: { price: { amount: 5, currency: 'BRL' } },
    });
    expect(offer.offers[0]).toMatchObject({ shop: 'Nuuvem', cut: 80 });
  });

  it('informa o jogo da IGDB quando existe, para redirecionar', async () => {
    const offer = await service({ title: 'Na Steam', appid: 730 }, 42).getOffer(ID, 'hide');
    expect(offer.igdbId).toBe(42);
    expect(offer.steamUrl).toBe('https://store.steampowered.com/app/730/');
  });

  it('bloqueia adultos com o filtro ligado e responde 404 para ID desconhecido', async () => {
    await expect(service({ title: 'Adulto', mature: true }).getOffer(ID, 'hide')).rejects.toBeInstanceOf(AdultContentError);
    await expect(service({ title: 'Adulto IGDB', appid: 1 }, 7, [7]).getOffer(ID, 'hide')).rejects.toBeInstanceOf(
      AdultContentError,
    );
    await expect(service('missing').getOffer(ID, 'hide')).rejects.toBeInstanceOf(NotFoundError);
  });
});
