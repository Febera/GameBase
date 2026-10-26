import type {
  AdultMode,
  Page,
  SearchFacets,
  SearchFilters,
  SearchResult,
  SearchSuggestion,
  StoreOption,
} from '@rj/shared';
import type { MemoryCache } from '../cache/memoryCache.js';
import { quote } from '../clients/apicalypse.js';
import type { IgdbClient } from '../clients/igdb.js';
import type { ItadClient } from '../clients/itad.js';
import { MissingConfigError, UpstreamError } from '../lib/errors.js';
import { type Clock, systemClock } from '../lib/time.js';
import type { AdultContentFilter } from './adultContent.js';
import { playerCounts } from './gameDetailsService.js';
import { dedupeEditions } from './dedupe.js';
import { categorize, steamPrice } from './gamesService.js';
import type { IgdbLookup } from './igdbLookup.js';
import { CARD_FIELDS, type IgdbGame, igdbImageUrl, toGameCard } from './igdbMappers.js';
import { paginate } from './listing.js';
import { ACCEPTED_GAME_TYPES, buildSearchQuery, PC_PLATFORM_ID } from './searchQuery.js';
import type { SteamSync } from './steamSync.js';
import type { SteamApp } from '../db/steamAppsRepository.js';

/** Lojas oferecidas no filtro, reconhecidas pelo nome da fonte na IGDB. */
export const STORES: (StoreOption & { match: RegExp; fallbackId?: number })[] = [
  { key: 'steam', name: 'Steam', match: /^steam$/i, fallbackId: 1 },
  { key: 'epic', name: 'Epic Games Store', match: /epic/i, fallbackId: 26 },
  { key: 'gog', name: 'GOG', match: /^gog/i, fallbackId: 5 },
  { key: 'itch', name: 'itch.io', match: /itch/i },
  { key: 'microsoft', name: 'Microsoft Store', match: /microsoft|xbox/i },
  { key: 'ea', name: 'EA app', match: /^ea\b|origin/i },
  { key: 'ubisoft', name: 'Ubisoft Connect', match: /ubisoft|uplay/i },
  { key: 'battlenet', name: 'Battle.net', match: /battle\.?net|blizzard/i },
  { key: 'amazon', name: 'Amazon Games', match: /amazon/i },
];

/** A busca trabalha sobre os 500 primeiros resultados da IGDB (o máximo por consulta). */
export const SEARCH_WINDOW = 500;
const WINDOW_TTL_MS = 10 * 60 * 1000;
const FACETS_TTL_MS = 24 * 60 * 60 * 1000;

const SEARCH_FIELDS = [
  CARD_FIELDS,
  'genres.name,artworks.image_id,screenshots.image_id',
  'multiplayer_modes.platform,multiplayer_modes.onlinemax,multiplayer_modes.onlinecoopmax',
  'multiplayer_modes.offlinemax,multiplayer_modes.offlinecoopmax',
].join(',');

interface IgdbSearchGame extends IgdbGame {
  genres?: { name: string }[];
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  multiplayer_modes?: Parameters<typeof playerCounts>[0];
}

interface Candidate {
  result: SearchResult;
  adult: boolean;
  steamAppId: number | null;
  igdbCount: number;
}

interface Deps {
  igdb: IgdbClient;
  cache: MemoryCache;
  adult: AdultContentFilter;
  lookup: IgdbLookup;
  steam: SteamSync | null;
  /** Para a validade das promoções da Steam (opcional). */
  itad?: ItadClient;
  now?: Clock;
  log?: (message: string) => void;
}

const ALL_PRICES = ['free', 'demo', 'paid'] as const;

/**
 * Nenhuma opção marcada numa categoria equivale a todas marcadas: em ambos os casos, sem filtro.
 * Normalizar aqui faz as duas formas usarem o mesmo cache e o mesmo resultado.
 */
export function normalizeFilters(filters: SearchFilters): SearchFilters {
  const prices = new Set(filters.prices ?? []);
  const stores = new Set(filters.stores ?? []);
  return {
    ...filters,
    prices: ALL_PRICES.every((p) => prices.has(p)) ? [] : [...prices],
    stores: STORES.every((s) => stores.has(s.key)) ? [] : [...stores],
  };
}

export interface SearchService {
  search(filters: SearchFilters, offset: number, limit: number, adult: AdultMode): Promise<Page<SearchResult>>;
  suggest(q: string, adult: AdultMode): Promise<SearchSuggestion[]>;
  facets(): Promise<SearchFacets>;
}

function toResult(game: IgdbSearchGame): SearchResult {
  const wide = game.artworks?.[0]?.image_id ?? game.screenshots?.[0]?.image_id;
  return {
    ...toGameCard(game),
    artwork: wide ? igdbImageUrl(wide, 'screenshot_med') : null,
    genres: (game.genres ?? []).map((g) => g.name),
    players: playerCounts(game.multiplayer_modes),
  };
}

/** Chave estável dos filtros (sem paginação), para o cache da janela de resultados. */
function filtersKey(filters: SearchFilters): string {
  const sorted = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(sorted);
}

export function createSearchService({
  igdb,
  cache,
  adult,
  lookup,
  steam,
  itad,
  now = systemClock,
  log = () => {},
}: Deps): SearchService {
  /**
   * Fim da promoção na Steam de cada App ID, pela IsThereAnyDeal (a Steam não informa).
   * Duas consultas por página de resultados; cada resposta fica 30 min em cache.
   */
  async function promoEnds(appIds: number[]): Promise<Map<number, string | null>> {
    const result = new Map<number, string | null>();
    const missing: number[] = [];
    for (const id of appIds) {
      const hit = cache.get<string | null>(`promo:${id}`);
      if (hit !== undefined) result.set(id, hit);
      else missing.push(id);
    }
    if (!itad?.configured || missing.length === 0) return result;
    try {
      const idMap = await itad.itadIdsForSteam(missing);
      const appByItad = new Map<string, number>();
      for (const appId of missing) {
        const itadId = idMap[`app/${appId}`];
        if (itadId) appByItad.set(itadId, appId);
      }
      const prices = appByItad.size ? await itad.prices([...appByItad.keys()], 'BR', [61]) : [];
      for (const appId of missing) result.set(appId, null);
      for (const p of prices) {
        const appId = appByItad.get(p.id);
        const expiry = p.deals.find((deal) => deal.shop.id === 61)?.expiry ?? null;
        if (appId) result.set(appId, expiry ? expiry.slice(0, 10) : null);
      }
      for (const appId of missing) cache.set(`promo:${appId}`, result.get(appId) ?? null, 30 * 60 * 1000);
    } catch (error) {
      log(`Busca: validade das promoções indisponível. ${String(error)}`);
    }
    return result;
  }

  /** IDs das fontes de loja na IGDB, pelo nome; cai para IDs conhecidos se o endpoint não existir. */
  function storeSources(): Promise<{ field: string; ids: Map<string, number[]> }> {
    return cache.getOrSet('search:store-sources', FACETS_TTL_MS, async () => {
      try {
        const sources = await igdb.query<{ id: number; name: string }>(
          'external_game_sources',
          'fields id,name; limit 500;',
        );
        const ids = new Map(
          STORES.map((s) => [s.key, sources.filter((src) => s.match.test(src.name)).map((src) => src.id)]),
        );
        return { field: 'external_game_source', ids };
      } catch (error) {
        if (!(error instanceof UpstreamError) || ![400, 404].includes(error.status)) throw error;
        log('Busca: lista de lojas da IGDB indisponível, usando IDs conhecidos (Steam, Epic, GOG).');
        const ids = new Map(STORES.map((s) => [s.key, s.fallbackId ? [s.fallbackId] : []]));
        return { field: 'category', ids };
      }
    });
  }

  async function loadWindow(filters: SearchFilters): Promise<Candidate[]> {
    return cache.getOrSet(`search:${filtersKey(filters)}`, WINDOW_TTL_MS, async () => {
      let storeSourceIds: number[] = [];
      let sourceField = 'external_game_source';
      if (filters.stores?.length) {
        const sources = await storeSources();
        sourceField = sources.field;
        storeSourceIds = filters.stores.flatMap((key) => sources.ids.get(key) ?? []);
        // Lojas pedidas que a IGDB não conhece: nenhum jogo pode corresponder.
        if (storeSourceIds.length === 0) return [];
      }

      const built = buildSearchQuery(filters, {
        nowS: Math.floor(now() / 1000),
        storeSourceIds,
        sourceField,
      });
      const body = [
        built.search ? `search ${quote(built.search)};` : '',
        `fields ${SEARCH_FIELDS};`,
        `where ${built.where};`,
        built.sort ? `sort ${built.sort};` : '',
        `limit ${SEARCH_WINDOW};`,
      ].join(' ');
      const games = await igdb.query<IgdbSearchGame>('games', body);

      const ids = games.map((g) => g.id);
      const [adultIds, steamIds] = await Promise.all([adult.adultIgdbIds(ids), lookup.steamAppIdsFor(ids)]);
      return games.map((g) => ({
        result: toResult(g),
        adult: adultIds.has(g.id),
        steamAppId: steamIds.get(g.id) ?? null,
        igdbCount: g.total_rating_count ?? 0,
      }));
    });
  }

  return {
    async search(rawFilters, offset, limit, adultMode) {
      const filters = normalizeFilters(rawFilters);
      // A faixa de preço é aplicada depois, com os dados da Steam; não entra na consulta à IGDB.
      const window = await loadWindow({ ...filters, prices: [], showDuplicates: undefined });
      const wantedPrices = new Set(filters.prices);
      const needsSteamCategory = wantedPrices.size > 0;
      if (needsSteamCategory && !steam) {
        throw new MissingConfigError(
          'DATABASE_URL',
          'O filtro de preço precisa do banco, que não está disponível no servidor.',
        );
      }

      const shown = window.filter((c) => adultMode === 'show' || !c.adult);
      let pending = 0;
      type Row = { c: Candidate; app?: SteamApp };
      let rows: Row[] = shown.map((c) => ({ c }));

      if (steam) {
        const appIds = shown.flatMap((c) => (c.steamAppId ? [c.steamAppId] : []));
        const { apps } = await steam.read(appIds);
        rows = shown.map((c) => ({ c, app: c.steamAppId ? apps.get(c.steamAppId) : undefined }));
        // Para faixa de preço, todos precisam dos dados da Steam; senão, só a página exibida.
        const toRefresh = needsSteamCategory
          ? appIds
          : shown.slice(offset, offset + limit).flatMap((c) => (c.steamAppId ? [c.steamAppId] : []));
        steam.refresh(toRefresh).catch((error: unknown) => log(`Busca: falha ao enfileirar Steam: ${String(error)}`));
      }

      // Registros repetidos e edições do mesmo jogo viram um (a menos que peçam para mostrar).
      const merged = filters.showDuplicates
        ? rows.map((r) => ({ item: r, priceFrom: r }))
        : dedupeEditions(rows, (r) => ({
            name: r.c.result.name,
            hasImage: Boolean(r.c.result.cover || r.c.result.artwork),
            hasPrice: Boolean(r.app?.found && (r.app.isFree || r.app.price)),
            free: r.app?.isFree ?? null,
            popularity: r.app?.reviews?.total ?? r.c.igdbCount,
          }));

      const results: SearchResult[] = merged.flatMap(({ item: { c, app }, priceFrom }) => {
        const priced = priceFrom.app?.found ? priceFrom.app : app;
        if (app?.found && app.adultContent && adultMode === 'hide') return [];
        if (needsSteamCategory) {
          if (!priced?.found) {
            if (c.steamAppId && !app) pending++;
            return [];
          }
          const category = categorize({ ...priced, hasDemo: Boolean(app?.hasDemo || priced.hasDemo) });
          if (!category || !wantedPrices.has(category)) return [];
        }
        const reviews = app?.reviews ?? priced?.reviews ?? null;
        return [
          {
            ...c.result,
            free: priced?.found ? priced.isFree : c.result.free,
            price: priced?.found ? steamPrice(priced) : c.result.price,
            reviewCount: reviews?.total ?? (c.igdbCount || null),
            steamReviews: reviews,
            steamAppId: (priced?.found ? priced.appId : c.steamAppId) ?? null,
          } as SearchResult & { steamAppId: number | null },
        ];
      });

      const page = paginate(results, offset, limit);
      // Validade da promoção só para os itens da página que estão em promoção.
      const onSale = (page.items as (SearchResult & { steamAppId: number | null })[]).filter(
        (r) => r.steamAppId && r.price && r.price.cut > 0,
      );
      const ends = await promoEnds(onSale.map((r) => r.steamAppId!));
      const items = (page.items as (SearchResult & { steamAppId: number | null })[]).map(({ steamAppId, ...r }) => ({
        ...r,
        promoEndsAt: steamAppId ? (ends.get(steamAppId) ?? null) : null,
      }));
      return pending > 0 ? { ...page, items, pending } : { ...page, items };
    },

    async suggest(q, adultMode) {
      const text = q.trim();
      if (text.length < 2) return [];
      const entries = await cache.getOrSet(`suggest:${text.toLowerCase()}`, WINDOW_TTL_MS, async () => {
        const games = await igdb.query<IgdbGame>(
          'games',
          `search ${quote(text)}; fields name,first_release_date,cover.image_id; where platforms = (${PC_PLATFORM_ID}) & game_type = (${ACCEPTED_GAME_TYPES.join(',')}); limit 12;`,
        );
        const adultIds = await adult.adultIgdbIds(games.map((g) => g.id));
        return games.map((g) => ({
          adult: adultIds.has(g.id),
          item: {
            id: g.id,
            name: g.name,
            year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear().toString() : null,
            cover: g.cover?.image_id ? igdbImageUrl(g.cover.image_id, 'cover_small') : null,
          },
        }));
      });
      return entries
        .filter((e) => adultMode === 'show' || !e.adult)
        .slice(0, 6)
        .map((e) => e.item);
    },

    facets() {
      return cache.getOrSet('search:facets', FACETS_TTL_MS, async () => {
        const genres = await igdb.query<{ id: number; name: string }>(
          'genres',
          'fields id,name; sort name asc; limit 100;',
        );
        return {
          genres: genres.map((g) => ({ id: g.id, name: g.name })),
          stores: STORES.map(({ key, name }) => ({ key, name })),
        };
      });
    },
  };
}
