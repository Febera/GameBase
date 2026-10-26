import type { AdultContentFilter } from '../src/services/adultContent.js';
import type { DealsService } from '../src/services/dealsService.js';
import type { GameDetailsService } from '../src/services/gameDetailsService.js';
import type { GamesService } from '../src/services/gamesService.js';
import type { GiveawaysService } from '../src/services/giveawaysService.js';
import type { SearchService } from '../src/services/searchService.js';
import type { OfferService } from '../src/services/offerService.js';
import type { RecommendationsService } from '../src/services/recommendationsService.js';

const emptyPage = { items: [], nextOffset: null, total: 0 };

export const stubGames: GamesService = { getNewPopular: async () => emptyPage };
export const stubGameDetails: GameDetailsService = {
  getGame: async () => {
    throw new Error('não usado neste teste');
  },
};
export const stubGiveaways: GiveawaysService = { getGiveaways: async () => emptyPage, findFor: async () => null };
export const stubSearch: SearchService = {
  search: async () => emptyPage,
  suggest: async () => [],
  facets: async () => ({ genres: [], stores: [] }),
};
export const stubRecommendations: RecommendationsService = {
  board: async () => ({ entries: [], removeThreshold: 5, hidden: 0 }),
  status: async () => ({ entry: null, removeThreshold: 5 }),
  recommend: async () => ({ entry: null, removeThreshold: 5 }),
  vote: async () => ({ entry: null, removeThreshold: 5, removed: false }),
};
export const stubOffers: OfferService = {
  getOffer: async () => {
    throw new Error('não usado neste teste');
  },
};
export const stubDeals: DealsService = { getDeals: async () => emptyPage, getFreeDeals: async () => [] };

/** Filtro adulto que marca como adulto os IDs informados. */
export function adultFilter(adultIds: number[] = []): AdultContentFilter {
  return { adultIgdbIds: async (ids) => new Set(ids.filter((id) => adultIds.includes(id))) };
}

import type { SteamApp } from '../src/db/steamAppsRepository.js';
import type { IgdbLookup } from '../src/services/igdbLookup.js';
import type { SteamSync } from '../src/services/steamSync.js';

/** Lookup que só responde o que o teste passar; o resto devolve vazio. */
export function lookupStub(overrides: Partial<IgdbLookup> = {}): IgdbLookup {
  return {
    byTitles: async () => new Map(),
    bySteamAppIds: async () => new Map(),
    steamAppIdsFor: async () => new Map(),
    ...overrides,
  };
}

export function steamApp(appId: number, extra: Partial<SteamApp> = {}): SteamApp {
  return {
    appId,
    found: true,
    isFree: false,
    hasDemo: false,
    adultContent: false,
    price: { currency: 'BRL', initial: 10000, final: 10000, discountPercent: 0 },
    reviews: null,
    fetchedAt: new Date(),
    ...extra,
  };
}

/** Sincronização falsa: devolve os apps informados e registra o que foi pedido. */
export function steamSyncStub(apps: SteamApp[]): SteamSync & { refreshed: number[][] } {
  const byId = new Map(apps.map((a) => [a.appId, a]));
  const refreshed: number[][] = [];
  return {
    refreshed,
    async read(ids) {
      const found = new Map(ids.flatMap((id) => (byId.has(id) ? [[id, byId.get(id)!] as const] : [])));
      return { apps: found, pending: ids.length - found.size };
    },
    async refresh(ids) {
      refreshed.push(ids);
    },
    queued: 0,
    async idle() {},
  };
}
