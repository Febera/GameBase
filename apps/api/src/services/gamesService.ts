import type { AdultMode, GameCard, ListSort, NewGamesCategory, Page, SortOrder, StorePrice } from '@rj/shared';
import type { MemoryCache } from '../cache/memoryCache.js';
import type { IgdbClient } from '../clients/igdb.js';
import type { SteamApp } from '../db/steamAppsRepository.js';
import { MissingConfigError } from '../lib/errors.js';
import { type Clock, systemClock } from '../lib/time.js';
import type { AdultContentFilter } from './adultContent.js';
import type { IgdbLookup } from './igdbLookup.js';
import { CARD_FIELDS, type IgdbGame, toGameCard } from './igdbMappers.js';
import { dedupeEditions } from './dedupe.js';
import { paginate, visible } from './listing.js';
import { sortBy } from './sorting.js';
import type { SteamSync } from './steamSync.js';
import { pcCondition } from './pcPlatform.js';
export { PC_PLATFORM_ID } from './pcPlatform.js';

/** ID da plataforma "PC (Microsoft Windows)" na IGDB. */

/**
 * Tipos de jogo aceitos: jogo principal, expansão standalone, remake,
 * remaster, versão expandida e port. Ficam de fora DLCs, mods, bundles, episódios etc.
 */
export const ACCEPTED_GAME_TYPES = [0, 4, 8, 9, 10, 11];

/** popularity_type 1 = visitas à página do jogo na IGDB. */
export const POPULARITY_VISITS = 1;

export const NEW_GAMES_WINDOW_DAYS = 90;
/** Tamanho máximo de cada lista completa, já filtrada. */
export const MAX_PER_LIST = 100;
/** Candidatos guardados antes de dividir e filtrar: precisam render três listas. */
export const MAX_CANDIDATES = 400;
const POPULARITY_SAMPLE = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const DAY_S = 24 * 60 * 60;

interface Candidate {
  card: GameCard;
  /** Marcado como adulto pela IGDB. */
  adult: boolean;
  steamAppId: number | null;
  igdbCount: number;
}

interface Deps {
  igdb: IgdbClient;
  cache: MemoryCache;
  adult: AdultContentFilter;
  lookup: IgdbLookup;
  /** Ausente quando o banco não está configurado: as divisões ficam indisponíveis. */
  steam: SteamSync | null;
  now?: Clock;
  log?: (message: string) => void;
}

export interface GamesService {
  getNewPopular(
    offset: number,
    limit: number,
    adult: AdultMode,
    category?: NewGamesCategory,
    sort?: ListSort,
    order?: SortOrder,
  ): Promise<Page<GameCard>>;
}

/** Em qual divisão o jogo entra, pelos dados da Steam. Pagos com demo ficam só em "demo". */
export function categorize(app: SteamApp): NewGamesCategory | null {
  if (!app.found || app.isFree === null) return null;
  if (app.isFree) return 'free';
  return app.hasDemo ? 'demo' : 'paid';
}

export function steamPrice(app: SteamApp): StorePrice | null {
  if (!app.price) return null;
  const { currency, initial, final, discountPercent } = app.price;
  return {
    current: { amount: final / 100, currency },
    regular: { amount: initial / 100, currency },
    cut: discountPercent,
  };
}

export function createGamesService({
  igdb,
  cache,
  adult,
  lookup,
  steam,
  now = systemClock,
  log = () => {},
}: Deps): GamesService {
  /** Filtro comum: lançado na janela, para PC, tipo aceito e com capa. */
  function newGamesWhere(): string {
    const nowS = Math.floor(now() / 1000);
    const fromS = nowS - NEW_GAMES_WINDOW_DAYS * DAY_S;
    return [
      `first_release_date >= ${fromS}`,
      `first_release_date <= ${nowS}`,
      pcCondition(),
      `game_type = (${ACCEPTED_GAME_TYPES.join(',')})`,
      'cover != null',
    ].join(' & ');
  }

  /**
   * Monta o ranking em duas fontes:
   * 1. Os 500 jogos mais visitados na IGDB, filtrados pela janela de lançamento.
   * 2. Se faltar jogo, completa com lançamentos recentes com mais avaliações e "hype".
   * Cada candidato sai com a marca de conteúdo adulto da IGDB e o App ID da Steam.
   */
  async function buildCandidates(): Promise<Candidate[]> {
    const where = newGamesWhere();

    const primitives = await igdb.query<{ game_id: number; value: number }>(
      'popularity_primitives',
      `fields game_id,value; where popularity_type = ${POPULARITY_VISITS}; sort value desc; limit ${POPULARITY_SAMPLE};`,
    );
    const visits = new Map(primitives.map((p) => [p.game_id, p.value]));

    let ranked: IgdbGame[] = [];
    if (visits.size > 0) {
      ranked = await igdb.query<IgdbGame>(
        'games',
        `fields ${CARD_FIELDS}; where id = (${[...visits.keys()].join(',')}) & ${where}; limit ${POPULARITY_SAMPLE};`,
      );
      ranked.sort((a, b) => (visits.get(b.id) ?? 0) - (visits.get(a.id) ?? 0));
    }

    if (ranked.length < MAX_CANDIDATES) {
      const seen = new Set(ranked.map((g) => g.id));
      const fallback = await igdb.query<IgdbGame>(
        'games',
        `fields ${CARD_FIELDS}; where ${where}; sort total_rating_count desc; limit 500;`,
      );
      const engagement = (g: IgdbGame) => (g.total_rating_count ?? 0) * 10 + (g.hypes ?? 0);
      ranked.push(
        ...fallback.filter((g) => !seen.has(g.id)).sort((a, b) => engagement(b) - engagement(a)),
      );
    }

    const candidates = ranked.slice(0, MAX_CANDIDATES);
    const ids = candidates.map((g) => g.id);
    const [adultIds, steamIds] = await Promise.all([adult.adultIgdbIds(ids), lookup.steamAppIdsFor(ids)]);
    return candidates.map((g) => ({
      card: toGameCard(g),
      adult: adultIds.has(g.id),
      steamAppId: steamIds.get(g.id) ?? null,
      igdbCount: g.total_rating_count ?? 0,
    }));
  }

  async function byCategory(
    candidates: Candidate[],
    category: NewGamesCategory,
    adultMode: AdultMode,
  ): Promise<{ list: GameCard[]; pending: number }> {
    if (!steam) {
      throw new MissingConfigError(
        'DATABASE_URL',
        'O banco não está disponível no servidor, então não dá para separar grátis, demos e pagos. ' +
          'O motivo aparece no log da API, logo ao iniciar.',
      );
    }
    const appIds = candidates.flatMap((c) => (c.steamAppId ? [c.steamAppId] : []));
    // Atualiza em segundo plano: a resposta usa o que já está no banco.
    steam.refresh(appIds).catch((error: unknown) => log(`Steam: falha ao enfileirar: ${String(error)}`));
    const { apps, pending } = await steam.read(appIds);

    const withApp = candidates.flatMap((c) => {
      const app = c.steamAppId ? apps.get(c.steamAppId) : undefined;
      return app?.found ? [{ c, app }] : [];
    });

    // Edições do mesmo jogo viram uma entrada só, com preço emprestado se preciso (ex.: GTA V).
    const merged = dedupeEditions(withApp, ({ c, app }) => ({
      name: c.card.name,
      hasImage: Boolean(c.card.cover),
      hasPrice: Boolean(app.isFree || app.price),
      free: app.isFree,
      popularity: app.reviews?.total ?? c.igdbCount,
    }));

    const entries = merged.flatMap(({ item: { c, app }, priceFrom }) => {
      const effective = { ...priceFrom.app, hasDemo: app.hasDemo || priceFrom.app.hasDemo };
      if (categorize(effective) !== category) return [];
      // Pago sem preço (nem grátis) não dá para comprar: fica fora da home.
      if (!effective.isFree && !effective.price) return [];
      const reviews = app.reviews ?? priceFrom.app.reviews;
      const card: GameCard = {
        ...c.card,
        free: effective.isFree,
        price: steamPrice(effective),
        reviewCount: reviews?.total ?? (c.igdbCount || null),
        steamReviews: reviews,
      };
      return [{ item: card, adult: c.adult || app.adultContent || priceFrom.app.adultContent }];
    });
    return { list: visible(entries, adultMode), pending };
  }

  return {
    async getNewPopular(offset, limit, adultMode, category, sort = 'reviews', order = 'desc') {
      // Lista pesada: depois da primeira vez, serve a versão anterior enquanto recarrega (e sobrevive à hibernação).
      const candidates = await cache.getOrSetStale('games:new-popular', CACHE_TTL_MS, buildCandidates);
      if (!category) {
        const all = visible(
          candidates.map((c) => ({ item: c.card, adult: c.adult })),
          adultMode,
        );
        return paginate(all.slice(0, MAX_PER_LIST), offset, limit);
      }
      const { list, pending } = await byCategory(candidates, category, adultMode);
      const sorted = sortBy(
        list,
        (g) => ({
          reviews: g.reviewCount ?? null,
          discount: g.free ? 100 : (g.price?.cut ?? 0),
          value: g.price?.regular.amount ?? null,
          release: g.releaseDate,
        }),
        sort,
        order,
      ).slice(0, MAX_PER_LIST);
      return { ...paginate(sorted, offset, limit), pending };
    },
  };
}
