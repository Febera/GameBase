import type { AdultMode, GameCard, GameDetails, PlayerCounts } from '@rj/shared';
import type { MemoryCache } from '../cache/memoryCache.js';
import { type IgdbClient, type IgdbNamedQuery, igdbMultiquery } from '../clients/igdb.js';
import type { ItadClient } from '../clients/itad.js';
import { AdultContentError, NotFoundError } from '../lib/errors.js';
import { type Clock, systemClock } from '../lib/time.js';
import type { AdultContentFilter } from './adultContent.js';
import { steamPrice } from './gamesService.js';
import type { IgdbLookup } from './igdbLookup.js';
import { CARD_FIELDS, type IgdbGame, igdbImageUrl, toGameCard } from './igdbMappers.js';
import { createItadPricing, type ItadPricing } from './itadPricing.js';
import { storeLinksFrom } from './storeLinks.js';
import { dedupeEditions } from './dedupe.js';
import type { GiveawaysService } from './giveawaysService.js';
import type { SteamSync } from './steamSync.js';
import { PC_PLATFORM_ID, pcCondition } from './pcPlatform.js';

const MAX_SIMILAR = 9;
const DETAILS_TTL_MS = 6 * 60 * 60 * 1000;

interface Named {
  name: string;
}

interface MultiplayerMode {
  platform?: number;
  onlinemax?: number;
  onlinecoopmax?: number;
  offlinemax?: number;
  offlinecoopmax?: number;
}

/** Jogo completo como pedimos à IGDB. */
export interface IgdbGameFull extends IgdbGame {
  summary?: string;
  storyline?: string;
  aggregated_rating?: number;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  videos?: { video_id: string; name?: string }[];
  genres?: Named[];
  themes?: Named[];
  game_modes?: Named[];
  player_perspectives?: Named[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: Named }[];
  websites?: { url: string }[];
  similar_games?: number[];
  multiplayer_modes?: MultiplayerMode[];
}

const DETAIL_FIELDS = [
  CARD_FIELDS,
  'summary,storyline,aggregated_rating',
  'artworks.image_id,screenshots.image_id,videos.video_id,videos.name',
  'genres.name,themes.name,game_modes.name,player_perspectives.name',
  'involved_companies.developer,involved_companies.publisher,involved_companies.company.name',
  'websites.url,similar_games',
  'multiplayer_modes.platform,multiplayer_modes.onlinemax,multiplayer_modes.onlinecoopmax',
  'multiplayer_modes.offlinemax,multiplayer_modes.offlinecoopmax',
].join(',');

/** Maior número de jogadores entre os modos de PC (ou de todos, se nenhum for marcado como PC). */
export function playerCounts(modes: MultiplayerMode[] | undefined): PlayerCounts | null {
  if (!modes?.length) return null;
  const pc = modes.filter((m) => m.platform === PC_PLATFORM_ID);
  const pool = pc.length ? pc : modes;
  const max = (key: keyof MultiplayerMode) => {
    const values = pool.map((m) => m[key] ?? 0).filter((v) => v > 0);
    return values.length ? Math.max(...values) : null;
  };
  const counts: PlayerCounts = {
    onlineMax: max('onlinemax'),
    onlineCoopMax: max('onlinecoopmax'),
    offlineMax: max('offlinemax'),
    offlineCoopMax: max('offlinecoopmax'),
  };
  return Object.values(counts).some((v) => v !== null) ? counts : null;
}

const names = (list: Named[] | undefined) => (list ?? []).map((item) => item.name);

export { yearLowFrom } from './itadPricing.js';

interface Deps {
  igdb: IgdbClient;
  lookup: IgdbLookup;
  adult: AdultContentFilter;
  itad: ItadClient;
  steam: SteamSync | null;
  cache: MemoryCache;
  /** Opcional: por padrão, criado a partir de `itad` e `cache`. */
  pricing?: ItadPricing;
  /** Para mostrar o resgate quando o jogo está de graça por tempo limitado. */
  giveaways?: Pick<GiveawaysService, 'findFor'>;
  now?: Clock;
  log?: (message: string) => void;
}

export interface GameDetailsService {
  getGame(id: number, adult: AdultMode): Promise<GameDetails>;
}

export function createGameDetailsService({
  igdb,
  lookup,
  adult,
  itad,
  steam,
  cache,
  pricing: givenPricing,
  giveaways,
  now = systemClock,
  log = () => {},
}: Deps): GameDetailsService {
  const pricing = givenPricing ?? createItadPricing({ itad, cache, now, log });
  /**
   * Similares e quais deles (e o próprio jogo) são adultos. Com multiquery, as duas consultas
   * vão à IGDB numa requisição só.
   */
  async function similarAndAdult(id: number, similarIds: number[]): Promise<{ similar: IgdbGame[]; adultIds: Set<number> }> {
    const similarQuery = `fields ${CARD_FIELDS}; where id = (${similarIds.join(',')}) & ${pcCondition()} & cover != null; limit 30;`;
    const condition = adult.adultCondition ? await adult.adultCondition() : undefined;
    if (condition === undefined) {
      // Filtro sem condição exposta (ex.: nos testes): duas consultas, como antes.
      const [similar, adultIds] = await Promise.all([
        similarIds.length ? igdb.query<IgdbGame>('games', similarQuery) : Promise.resolve([]),
        adult.adultIgdbIds([id, ...similarIds]),
      ]);
      return { similar, adultIds };
    }
    const queries: IgdbNamedQuery[] = [];
    if (similarIds.length) queries.push({ name: 'similar', endpoint: 'games', body: similarQuery });
    if (condition) {
      queries.push({
        name: 'adult',
        endpoint: 'games',
        body: `fields id; where id = (${[id, ...similarIds].join(',')}) & ${condition}; limit 500;`,
      });
    }
    const result = await igdbMultiquery(igdb, queries);
    return {
      similar: (result.similar ?? []) as IgdbGame[],
      adultIds: new Set(((result.adult ?? []) as { id: number }[]).map((r) => r.id)),
    };
  }

  /** Parte que muda pouco: dados da IGDB, similares e App ID da Steam. */
  function loadBase(id: number) {
    return cache.getOrSet(`game:${id}`, DETAILS_TTL_MS, async () => {
      const [game] = await igdb.query<IgdbGameFull>('games', `fields ${DETAIL_FIELDS}; where id = ${id}; limit 1;`);
      if (!game) throw new NotFoundError(`Jogo ${id} não encontrado.`);

      const similarIds = (game.similar_games ?? []).slice(0, 30);
      const [{ similar, adultIds }, steamIds] = await Promise.all([
        similarAndAdult(id, similarIds),
        lookup.steamAppIdsFor([id, ...similarIds]),
      ]);
      // Mantém a ordem de relevância da IGDB.
      const similarById = new Map(similar.map((g) => [g.id, g]));
      const similarOrdered = similarIds.flatMap((sid) => {
        const g = similarById.get(sid);
        return g ? [{ card: toGameCard(g), adult: adultIds.has(sid), steamAppId: steamIds.get(sid) ?? null }] : [];
      });

      return {
        game,
        adult: adultIds.has(id),
        similar: similarOrdered,
        steamAppId: steamIds.get(id) ?? null,
      };
    });
  }

  /**
   * Acrescenta preço e "grátis" da Steam aos similares, com o que já estiver no banco,
   * e tira os marcados como adultos na Steam quando o filtro está ligado.
   */
  async function withSteamPrices(
    list: { card: GameCard; adult: boolean; steamAppId: number | null }[],
    adultMode: AdultMode,
  ): Promise<GameCard[]> {
    // Registros repetidos do mesmo jogo aparecem uma vez só entre os parecidos.
    const visible = dedupeEditions(
      list.filter((s) => adultMode === 'show' || !s.adult),
      (s) => ({ name: s.card.name, hasImage: Boolean(s.card.cover), hasPrice: true, free: null, popularity: 0 }),
    ).map((d) => d.item);
    const appIds = visible.flatMap((s) => (s.steamAppId ? [s.steamAppId] : []));
    if (!steam || appIds.length === 0) return visible.slice(0, MAX_SIMILAR).map((s) => s.card);
    try {
      steam.refresh(appIds).catch(() => {});
      const { apps } = await steam.read(appIds);
      return visible
        .flatMap((s) => {
          const app = s.steamAppId ? apps.get(s.steamAppId) : undefined;
          if (!app?.found) return [s.card];
          if (app.adultContent && adultMode === 'hide') return [];
          return [{ ...s.card, free: app.isFree, price: steamPrice(app) }];
        })
        .slice(0, MAX_SIMILAR);
    } catch (error) {
      log(`Similares: preços indisponíveis. ${String(error)}`);
      return visible.slice(0, MAX_SIMILAR).map((s) => s.card);
    }
  }

  return {
    async getGame(id, adultMode) {
      const base = await loadBase(id);
      const { game, steamAppId } = base;

      const steamData = steamAppId && steam ? await readSteam(steam, steamAppId, log) : null;
      const prices = await pricing.forGame({ igdbId: game.id, title: game.name, steamAppId });
      const giveaway = giveaways ? await giveaways.findFor({ igdbId: game.id, itadId: prices.itadId }, adultMode) : null;

      const isAdult = base.adult || Boolean(steamData?.adultContent) || prices.mature;
      if (isAdult && adultMode === 'hide') throw new AdultContentError();

      const card = toGameCard(game);
      const companies = game.involved_companies ?? [];
      const hero = game.artworks?.[0]?.image_id ?? game.screenshots?.[0]?.image_id;
      const similar = await withSteamPrices(base.similar, adultMode);

      return {
        id: game.id,
        name: game.name,
        slug: game.slug,
        summary: game.summary ?? null,
        storyline: game.storyline ?? null,
        cover: card.cover,
        heroImage: hero ? igdbImageUrl(hero, '1080p') : null,
        releaseDate: card.releaseDate,
        rating: card.rating,
        ratingCount: game.total_rating_count ?? 0,
        steamReviews: prices.steamReviews,
        criticRating: typeof game.aggregated_rating === 'number' ? Math.round(game.aggregated_rating) : null,
        genres: names(game.genres),
        themes: names(game.themes),
        modes: names(game.game_modes),
        perspectives: names(game.player_perspectives),
        developers: companies.filter((c) => c.developer && c.company).map((c) => c.company!.name),
        publishers: companies.filter((c) => c.publisher && c.company).map((c) => c.company!.name),
        players: playerCounts(game.multiplayer_modes),
        screenshots: (game.screenshots ?? []).map((s) => ({
          thumb: igdbImageUrl(s.image_id, 'screenshot_med'),
          full: igdbImageUrl(s.image_id, '1080p'),
        })),
        videos: (game.videos ?? []).map((v) => ({ youtubeId: v.video_id, name: v.name ?? 'Trailer' })),
        steam: steamAppId
          ? {
              appId: steamAppId,
              url: `https://store.steampowered.com/app/${steamAppId}/`,
              free: steamData?.found ? steamData.isFree : null,
              hasDemo: steamData?.found ? steamData.hasDemo : null,
              price: steamData?.found ? steamPrice(steamData) : null,
            }
          : null,
        offers: prices.offers,
        historyLow: prices.historyLow,
        yearLow: prices.yearLow,
        storeLinks: storeLinksFrom((game.websites ?? []).map((w) => w.url)),
        similar,
        giveaway,
      };
    },
  };
}

/** Lê os dados da Steam do banco e, se faltarem ou estiverem velhos, pede para atualizar. */
async function readSteam(steam: SteamSync, appId: number, log: (m: string) => void) {
  try {
    steam.refresh([appId]).catch((error: unknown) => log(`Steam: falha ao enfileirar ${appId}: ${String(error)}`));
    const { apps } = await steam.read([appId]);
    return apps.get(appId) ?? null;
  } catch (error) {
    log(`Steam: falha ao ler ${appId}: ${String(error)}`);
    return null;
  }
}
