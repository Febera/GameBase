import type { AdultMode, DealCard, ListSort, Page, SortOrder } from '@rj/shared';
import type { MemoryCache } from '../cache/memoryCache.js';
import { chunk } from '../clients/apicalypse.js';
import type { ItadClient, ItadDealItem } from '../clients/itad.js';
import type { AdultContentFilter } from './adultContent.js';
import type { IgdbLookup } from './igdbLookup.js';
import { type IgdbGame, toGameCard } from './igdbMappers.js';
import { type Flagged, type ListEntry, paginate } from './listing.js';
import { sortBy } from './sorting.js';
import type { SteamSync } from './steamSync.js';

/** "Grandes ofertas": de 70% a 99%. Com 100%, o jogo vai para "Grátis por tempo limitado". */
export const DEAL_CUT = { min: 70, max: 99 };
export const FREE_CUT = { min: 100, max: 100 };
const COUNTRY = 'BR';
const PAGE_SIZE = 200;
/** Até 4.000 ofertas por faixa: cobre todas as de 70%+ que a ITAD lista na região. */
const MAX_PAGES = 20;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface Deps {
  itad: ItadClient;
  lookup: IgdbLookup;
  adult: AdultContentFilter;
  cache: MemoryCache;
  /** Para avaliações da Steam; sem banco, ordena pelas avaliações da IGDB. */
  steam?: SteamSync | null;
  log?: (message: string) => void;
}

export interface DealsService {
  getDeals(
    offset: number,
    limit: number,
    adult: AdultMode,
    sort?: ListSort,
    order?: SortOrder,
  ): Promise<Page<DealCard>>;
  /** Jogos pagos com 100% de desconto agora (com App ID da Steam, para avaliações). */
  getFreeDeals(adult: AdultMode): Promise<ListEntry<DealCard>[]>;
}

/** Desconto maior primeiro; no empate, a nota maior; sem nota, por último. */
export function compareDeals(a: DealCard, b: DealCard): number {
  if (b.cut !== a.cut) return b.cut - a.cut;
  return (b.rating ?? -1) - (a.rating ?? -1);
}

/** Preenche o total de avaliações da Steam (ou da IGDB) e devolve a lista visível. */
export async function withReviews<T extends { reviewCount: number | null }>(
  entries: ListEntry<T>[],
  steam: SteamSync | null | undefined,
  adultMode: AdultMode,
  log: (m: string) => void,
): Promise<T[]> {
  const visible = entries.filter((e) => adultMode === 'show' || !e.adult);
  const appIds = visible.flatMap((e) => (e.steamAppId ? [e.steamAppId] : []));
  let apps = new Map<number, { reviews: { total: number } | null; adultContent: boolean }>();
  if (steam && appIds.length) {
    try {
      // Listas grandes vão para a fila lenta: não atrasam os jogos que alguém está vendo.
      // Preço não: as ofertas já trazem o preço da ITAD. Da Steam só interessam avaliações e conteúdo adulto.
      steam.refresh(appIds, 'low', { skipPrice: true }).catch(() => {});
      apps = (await steam.read(appIds)).apps;
    } catch (error) {
      log(`Avaliações da Steam indisponíveis: ${String(error)}`);
    }
  }
  return visible.flatMap((e) => {
    const app = e.steamAppId ? apps.get(e.steamAppId) : undefined;
    if (app?.adultContent && adultMode === 'hide') return [];
    return [{ ...e.item, reviewCount: app?.reviews?.total ?? (e.igdbCount || null) }];
  });
}

export function createDealsService({ itad, lookup, adult, cache, steam, log = () => {} }: Deps): DealsService {
  async function fetchDeals(mature: boolean, cut: { min: number; max: number }): Promise<ItadDealItem[]> {
    const items: ItadDealItem[] = [];
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await itad.deals({ offset, limit: PAGE_SIZE, country: COUNTRY, minCut: cut.min, maxCut: cut.max, mature });
      items.push(...result.list);
      if (!result.hasMore) break;
      offset = result.nextOffset;
    }
    // Só jogos completos (sem DLC, trilha sonora, pacotes) dentro da faixa de desconto.
    return items.filter((item) => item.type === 'game' && item.deal.cut >= cut.min && item.deal.cut <= cut.max);
  }

  /** Liga cada oferta ao App ID da Steam e ao jogo da IGDB, para avaliações, nota e capa. */
  async function linkIds(items: ItadDealItem[]) {
    const appIdByItad = new Map<string, number>();
    const igdbByItad = new Map<string, IgdbGame>();
    if (items.length === 0) return { appIdByItad, igdbByItad };
    try {
      const steamByItad: Record<string, string[] | null> = {};
      for (const part of chunk(items.map((i) => i.id), PAGE_SIZE)) {
        Object.assign(steamByItad, await itad.steamIdsFor(part));
      }
      for (const [itadId, shopIds] of Object.entries(steamByItad)) {
        const app = shopIds?.find((id) => id.startsWith('app/'));
        if (app) appIdByItad.set(itadId, Number(app.slice('app/'.length)));
      }
      const games = await lookup.bySteamAppIds([...appIdByItad.values()].map(String));
      for (const [itadId, appId] of appIdByItad) {
        const game = games.get(String(appId));
        if (game) igdbByItad.set(itadId, game);
      }
    } catch (error) {
      log(`Ofertas: não foi possível cruzar com a IGDB/Steam, seguindo sem notas. ${String(error)}`);
    }
    return { appIdByItad, igdbByItad };
  }

  async function build(mature: boolean, cut: { min: number; max: number }): Promise<ListEntry<DealCard>[]> {
    const items = await fetchDeals(mature, cut);
    const { appIdByItad, igdbByItad } = await linkIds(items);
    const adultIgdb = await adult.adultIgdbIds([...igdbByItad.values()].map((g) => g.id));

    return items.map((item) => {
      const game = igdbByItad.get(item.id);
      const gameCard = game ? toGameCard(game) : null;
      return {
        adult: item.mature || (game ? adultIgdb.has(game.id) : false),
        steamAppId: appIdByItad.get(item.id) ?? null,
        igdbCount: game?.total_rating_count ?? 0,
        item: {
          id: item.id,
          title: item.title,
          cover: gameCard?.cover ?? null,
          boxart: item.assets?.boxart ?? null,
          igdbId: game?.id ?? null,
          shop: item.deal.shop.name,
          price: item.deal.price,
          regular: item.deal.regular,
          cut: item.deal.cut,
          rating: gameCard?.rating ?? null,
          releaseDate: gameCard?.releaseDate ?? null,
          reviewCount: null,
          expiry: item.deal.expiry,
          url: item.deal.url,
        },
      };
    });
  }

  // Com o filtro ligado, a própria IsThereAnyDeal já exclui os jogos marcados como adultos.
  const matureFor = (mode: AdultMode) => mode === 'show';

  return {
    async getDeals(offset, limit, adultMode, sort = 'reviews', order = 'desc') {
      const mature = matureFor(adultMode);
      // Lista grande: depois da primeira montagem, serve a anterior enquanto recarrega.
      const entries = await cache.getOrSetStale(`deals:${mature ? 'all' : 'safe'}`, CACHE_TTL_MS, async () =>
        (await build(mature, DEAL_CUT)).sort((a, b) => compareDeals(a.item, b.item)),
      );
      const list = await withReviews(entries, steam, adultMode, log);
      const sorted = sortBy(
        list,
        (d) => ({ reviews: d.reviewCount, discount: d.cut, value: d.regular.amount, release: d.releaseDate }),
        sort === 'value' ? 'discount' : sort,
        order,
      );
      return paginate(sorted, offset, limit);
    },

    async getFreeDeals(adultMode) {
      const mature = matureFor(adultMode);
      return cache.getOrSetStale(`deals:free:${mature ? 'all' : 'safe'}`, CACHE_TTL_MS, async () =>
        (await build(mature, FREE_CUT)).sort((a, b) => b.item.regular.amount - a.item.regular.amount),
      );
    },
  };
}

export type { Flagged };
