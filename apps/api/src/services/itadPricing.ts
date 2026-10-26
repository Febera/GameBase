import type { GameDetails, PriceLow, ShopOffer } from '@rj/shared';
import type { MemoryCache } from '../cache/memoryCache.js';
import type { ItadClient, ItadGameInfo, ItadHistoryEntry, ItadMoney } from '../clients/itad.js';
import { type Clock, systemClock } from '../lib/time.js';

const COUNTRY = 'BR';
const TTL_MS = 30 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface Pricing {
  itadId: string | null;
  offers: ShopOffer[];
  historyLow: PriceLow | null;
  yearLow: PriceLow | null;
  steamReviews: GameDetails['steamReviews'];
  mature: boolean;
  info: ItadGameInfo | null;
}

const EMPTY: Pricing = {
  itadId: null,
  offers: [],
  historyLow: null,
  yearLow: null,
  steamReviews: null,
  mature: false,
  info: null,
};

/**
 * Menor preço dos últimos 12 meses: o valor vem pronto da ITAD (`y1`); a data e a loja
 * saem do histórico, na ocorrência mais recente desse valor. Se o preço não mudou no período,
 * o histórico não tem a ocorrência e a data fica desconhecida.
 */
export function yearLowFrom(amount: ItadMoney | null | undefined, entries: ItadHistoryEntry[]): PriceLow | null {
  if (!amount) return null;
  const match = entries
    .filter((e) => e.deal && e.deal.price.amount <= amount.amount + 0.005)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  return {
    price: { amount: amount.amount, currency: amount.currency },
    shop: match?.shop.name ?? null,
    date: match ? match.timestamp.slice(0, 10) : null,
  };
}

export interface ItadPricing {
  /** Encontra o jogo na ITAD (pelo App ID da Steam ou título) e carrega preços. */
  forGame(game: { igdbId: number; title: string; steamAppId: number | null }): Promise<Pricing>;
  /** Carrega preços de um jogo já identificado na ITAD. */
  forItadId(itadId: string): Promise<Pricing>;
}

export function createItadPricing({
  itad,
  cache,
  now = systemClock,
  log = () => {},
}: {
  itad: ItadClient;
  cache: MemoryCache;
  now?: Clock;
  log?: (message: string) => void;
}): ItadPricing {
  async function load(itadId: string, mature: boolean): Promise<Pricing> {
    // Avaliações e históricos são extras: se falharem, segue sem eles.
    const [[prices], info, lows, history] = await Promise.all([
      itad.prices([itadId], COUNTRY),
      itad.gameInfo(itadId).catch(() => null),
      itad.historyLow([itadId], COUNTRY).catch(() => []),
      itad.history(itadId, COUNTRY, new Date(now() - YEAR_MS)).catch(() => []),
    ]);

    const offers: ShopOffer[] = (prices?.deals ?? [])
      .map((d) => ({
        shop: d.shop.name,
        price: { amount: d.price.amount, currency: d.price.currency },
        regular: { amount: d.regular.amount, currency: d.regular.currency },
        cut: d.cut,
        drm: (d.drm ?? []).map((x) => x.name),
        url: d.url,
      }))
      .sort((a, b) => a.price.amount - b.price.amount);

    const allTime = lows.find((l) => l.id === itadId)?.low;
    const fallbackLow = prices?.historyLow?.all;
    const steamReview = info?.reviews?.find((r) => r.source === 'Steam' && r.score !== null && r.count);

    return {
      itadId,
      offers,
      historyLow: allTime
        ? {
            price: { amount: allTime.price.amount, currency: allTime.price.currency },
            shop: allTime.shop.name,
            date: allTime.timestamp.slice(0, 10),
          }
        : fallbackLow
          ? { price: { amount: fallbackLow.amount, currency: fallbackLow.currency }, shop: null, date: null }
          : null,
      yearLow: yearLowFrom(prices?.historyLow?.y1, history),
      steamReviews: steamReview ? { percent: steamReview.score!, count: steamReview.count!, url: steamReview.url } : null,
      mature: mature || Boolean(info?.mature),
      info,
    };
  }

  return {
    forGame({ igdbId, title, steamAppId }) {
      return cache.getOrSet(`pricing:igdb:${igdbId}`, TTL_MS, async () => {
        if (!itad.configured) return EMPTY;
        try {
          let found = steamAppId ? await itad.lookupBySteamAppId(steamAppId) : null;
          if (!found?.id) found = await itad.lookupByTitle(title);
          if (!found.id) return EMPTY;
          return await load(found.id, found.mature);
        } catch (error) {
          log(`Preços de ${title}: indisponíveis. ${String(error)}`);
          return EMPTY;
        }
      });
    },

    forItadId(itadId) {
      return cache.getOrSet(`pricing:itad:${itadId}`, TTL_MS, () => load(itadId, false));
    },
  };
}
