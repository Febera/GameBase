import { describe, expect, it, vi } from 'vitest';
import type { ItadClient } from '../src/clients/itad.js';
import type { SteamClient } from '../src/clients/steam.js';
import { withItadReviews } from '../src/services/steamReviewsFallback.js';
import { steamApp } from './stubs.js';

function itadWith(reviews: { score: number | null; source: string; count: number | null; url: string }[] | 'fail') {
  return {
    configured: true,
    itadIdsForSteam: vi.fn(async (ids: number[]) => Object.fromEntries(ids.map((id) => [`app/${id}`, `itad-${id}`]))),
    gameInfo: vi.fn(async () => {
      if (reviews === 'fail') throw new Error('fora do ar');
      return { reviews };
    }),
  } as unknown as ItadClient;
}

/** Cliente da Steam falso: só appDetails importa aqui; avaliações avulsas não vêm. */
const steamWith = (appDetails: SteamClient['appDetails']): SteamClient => ({
  appDetails,
  prices: async () => new Map(),
  reviews: async () => null,
});

describe('withItadReviews', () => {
  it('completa pela ITAD quando a Steam não traz as avaliações', async () => {
    const steam = steamWith(async (id: number) => steamApp(id, { reviews: null }));
    const itad = itadWith([
      { source: 'Metascore', score: 90, count: null, url: '' },
      { source: 'Steam', score: 96, count: 120_000, url: '' },
    ]);
    const app = await withItadReviews(steam, itad, () => {}).appDetails(730);
    expect(app.reviews).toEqual({ total: 120_000, percent: 96 });
  });

  it('não consulta a ITAD quando a Steam já trouxe, nem para jogos fora da loja', async () => {
    const itad = itadWith([]);
    const withReviews = steamWith(async (id: number) => steamApp(id, { reviews: { total: 10, percent: 80 } }));
    await withItadReviews(withReviews, itad, () => {}).appDetails(1);
    const notFound = steamWith(async (id: number) => steamApp(id, { found: false, reviews: null }));
    await withItadReviews(notFound, itad, () => {}).appDetails(2);
    expect(itad.itadIdsForSteam).not.toHaveBeenCalled();
  });

  it('falha da ITAD não derruba a fila: segue sem avaliações e registra', async () => {
    const log = vi.fn();
    const steam = steamWith(async (id: number) => steamApp(id, { reviews: null }));
    const app = await withItadReviews(steam, itadWith('fail'), log).appDetails(5);
    expect(app).toMatchObject({ found: true, reviews: null });
    expect(log).toHaveBeenCalledOnce();
  });

  it('avaliações avulsas: Steam primeiro, ITAD quando a Steam não traz', async () => {
    const itad = itadWith([{ source: 'Steam', score: 91, count: 3000, url: '' }]);
    const client = withItadReviews(steamWith(async (id) => steamApp(id)), itad, () => {});
    expect(await client.reviews(10)).toEqual({ total: 3000, percent: 91 });
    const direct = withItadReviews({ ...steamWith(async (id) => steamApp(id)), reviews: async () => ({ total: 5, percent: 60 }) }, itad, () => {});
    expect(await direct.reviews(10)).toEqual({ total: 5, percent: 60 });
  });
});
