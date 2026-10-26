import type { AdultMode, GiveawayCard, GiveawayInfo, ListSort, Page, SortOrder } from '@rj/shared';
import type { MemoryCache } from '../cache/memoryCache.js';
import type { GamerPowerClient, RawGiveaway } from '../clients/gamerpower.js';
import type { ItadClient } from '../clients/itad.js';
import type { AdultContentFilter } from './adultContent.js';
import { type DealsService, withReviews } from './dealsService.js';
import { type IgdbLookup, normalizeTitle } from './igdbLookup.js';
import { type IgdbGame, toGameCard } from './igdbMappers.js';
import { type ListEntry, paginate } from './listing.js';
import { sortBy } from './sorting.js';
import type { SteamSync } from './steamSync.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

interface Deps {
  gamerpower: GamerPowerClient;
  deals: DealsService;
  lookup: IgdbLookup;
  adult: AdultContentFilter;
  itad: ItadClient;
  cache: MemoryCache;
  steam?: SteamSync | null;
  log?: (message: string) => void;
}

export interface GiveawaysService {
  getGiveaways(
    offset: number,
    limit: number,
    adult: AdultMode,
    sort?: ListSort,
    order?: SortOrder,
  ): Promise<Page<GiveawayCard>>;
  /** O jogo está de graça agora? Usado nas páginas do jogo e da oferta. */
  findFor(ids: { igdbId?: number | null; itadId?: string | null }, adult: AdultMode): Promise<GiveawayInfo | null>;
}

/**
 * Tira do título do GamerPower o que não é nome do jogo:
 * "Hogwarts Legacy (Epic Games) Giveaway" → "Hogwarts Legacy".
 */
export function cleanGiveawayTitle(title: string): string {
  return title
    .replace(/\s*\((?:steam|epic(?: games)?(?: store)?|gog|itch\.?io|ubisoft|ea app|origin|prime gaming|amazon)[^)]*\)/gi, '')
    .replace(/\s+(?:giveaway|free (?:steam )?key|steam key|key giveaway)\s*$/i, '')
    .replace(/^free\s+/i, '')
    .replace(/\s+-\s+free(?: on [\w .]+)?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "PC, Epic Games Store" → "Epic Games Store". Só "PC" quando não há loja. */
export function storeName(platforms: string): string {
  const stores = platforms
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== 'pc');
  return stores.length ? stores.join(', ') : 'PC';
}

/** "2026-10-30 23:59:00" ou "2026-10-30T23:59:00+01:00" → "2026-10-30"; "N/A" → null. */
export function parseEndDate(value: string | null): string | null {
  const match = value ? /^(\d{4}-\d{2}-\d{2})/.exec(value) : null;
  return match ? match[1]! : null;
}

/** "$19.99" → 19.99, para ordenar pelo valor quando a fonte só dá texto. */
function worthNumber(worth: string | null): number | null {
  const n = worth ? Number.parseFloat(worth.replace(/[^0-9.]/g, '')) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

export function createGiveawaysService({
  gamerpower,
  deals,
  lookup,
  adult,
  itad,
  cache,
  steam,
  log = () => {},
}: Deps): GiveawaysService {
  /** Jogos pagos com 100% de desconto na IsThereAnyDeal. */
  async function fromItad(adultMode: AdultMode): Promise<ListEntry<GiveawayCard>[]> {
    if (!itad.configured) return [];
    try {
      const free = await deals.getFreeDeals(adultMode);
      return free.map(({ item, adult: isAdult, steamAppId, igdbCount }) => ({
        adult: isAdult,
        steamAppId,
        igdbCount,
        item: {
          id: `itad-${item.id}`,
          title: item.title,
          cover: item.cover,
          image: item.boxart,
          igdbId: item.igdbId,
          itadId: item.id,
          releaseDate: item.releaseDate,
          reviewCount: null,
          regular: item.regular,
          worth: null,
          endDate: parseEndDate(item.expiry),
          store: item.shop,
          url: item.url,
        },
      }));
    } catch (error) {
      log(`Grátis: ofertas de 100% indisponíveis, seguindo só com giveaways. ${String(error)}`);
      return [];
    }
  }

  async function fromGamerPower(): Promise<ListEntry<GiveawayCard>[]> {
    const raw = (await gamerpower.pcGameGiveaways()).filter(
      (g) => g.status.toLowerCase() === 'active' && g.type.toLowerCase() === 'game',
    );
    const titles = new Map(raw.map((g) => [g.id, cleanGiveawayTitle(g.title)]));

    // Associa cada giveaway a um jogo da IGDB, para ter capa, página e checar conteúdo adulto.
    let matches = new Map<string, IgdbGame>();
    try {
      matches = await lookup.byTitles([...titles.values()]);
    } catch (error) {
      log(`Giveaways: busca na IGDB falhou, seguindo sem capas. ${String(error)}`);
    }
    const igdbFor = (g: RawGiveaway) => matches.get(normalizeTitle(titles.get(g.id) ?? g.title));
    const matchedIds = raw.flatMap((g) => {
      const game = igdbFor(g);
      return game ? [game.id] : [];
    });
    const [adultIgdb, steamIds] = await Promise.all([
      adult.adultIgdbIds(matchedIds),
      lookup.steamAppIdsFor(matchedIds).catch(() => new Map<number, number>()),
    ]);

    // Sem correspondência na IGDB: a ITAD diz se é adulto e dá o ID para a página da oferta.
    const itadByGiveaway = new Map<number, { id: string | null; mature: boolean }>();
    if (itad.configured) {
      await Promise.all(
        raw
          .filter((g) => !igdbFor(g))
          .map(async (g) => {
            try {
              const result = await itad.lookupByTitle(titles.get(g.id) ?? g.title);
              if (result.found) itadByGiveaway.set(g.id, { id: result.id, mature: result.mature });
            } catch {
              // Falha pontual: o giveaway segue sem essa checagem.
            }
          }),
      );
    }

    return raw.map((g) => {
      const game = igdbFor(g);
      const itadInfo = itadByGiveaway.get(g.id);
      const card = game ? toGameCard(game) : null;
      return {
        adult: game ? adultIgdb.has(game.id) : Boolean(itadInfo?.mature),
        steamAppId: game ? (steamIds.get(game.id) ?? null) : null,
        igdbCount: game?.total_rating_count ?? 0,
        item: {
          id: `gp-${g.id}`,
          title: game?.name ?? titles.get(g.id) ?? g.title,
          cover: card?.cover ?? null,
          image: g.image || g.thumbnail || null,
          igdbId: game?.id ?? null,
          itadId: itadInfo?.id ?? null,
          releaseDate: card?.releaseDate ?? null,
          reviewCount: null,
          regular: null,
          worth: g.worth && g.worth !== 'N/A' ? g.worth : null,
          endDate: parseEndDate(g.end_date),
          store: storeName(g.platforms),
          url: g.open_giveaway_url || g.gamerpower_url,
        },
      };
    });
  }

  /** Junta as duas fontes; o mesmo jogo aparece uma vez só. */
  async function build(adultMode: AdultMode): Promise<ListEntry<GiveawayCard>[]> {
    const [itadItems, gpItems] = await Promise.all([fromItad(adultMode), fromGamerPower()]);
    const seen = new Set<string>();
    const merged: ListEntry<GiveawayCard>[] = [];
    for (const entry of [...itadItems, ...gpItems]) {
      const keys = [`t:${normalizeTitle(entry.item.title)}`];
      if (entry.item.igdbId) keys.push(`i:${entry.item.igdbId}`);
      if (keys.some((key) => seen.has(key))) continue;
      keys.forEach((key) => seen.add(key));
      merged.push(entry);
    }
    return merged;
  }

  const load = (adultMode: AdultMode) =>
    cache.getOrSetStale(`giveaways:${adultMode}`, CACHE_TTL_MS, () => build(adultMode));

  return {
    async getGiveaways(offset, limit, adultMode, sort = 'reviews', order = 'desc') {
      const list = await withReviews(await load(adultMode), steam, adultMode, log);
      // Aqui todos estão a 100%: "desconto" vira o valor original.
      const sorted = sortBy(
        list,
        (g) => ({
          reviews: g.reviewCount,
          discount: g.regular?.amount ?? worthNumber(g.worth),
          value: g.regular?.amount ?? worthNumber(g.worth),
          release: g.releaseDate,
        }),
        sort,
        order,
      );
      return paginate(sorted, offset, limit);
    },

    async findFor({ igdbId, itadId }, adultMode) {
      if (!igdbId && !itadId) return null;
      try {
        const entries = await load(adultMode);
        const found = entries.find(
          (e) => (igdbId && e.item.igdbId === igdbId) || (itadId && e.item.itadId === itadId),
        )?.item;
        return found
          ? { store: found.store, url: found.url, endDate: found.endDate, regular: found.regular, worth: found.worth }
          : null;
      } catch {
        return null;
      }
    },
  };
}
