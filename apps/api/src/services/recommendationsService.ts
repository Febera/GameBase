import type {
  AdultMode,
  RecommendationBoard,
  RecommendationEntry,
  RecommendationStatus,
  VoteKind,
} from '@rj/shared';
import type { MemoryCache } from '../cache/memoryCache.js';
import type { IgdbClient } from '../clients/igdb.js';
import {
  REMOVE_THRESHOLD,
  type RecommendationRow,
  type RecommendationsRepository,
} from '../db/recommendationsRepository.js';
import { MissingConfigError, NotFoundError } from '../lib/errors.js';
import type { AdultContentFilter } from './adultContent.js';
import { playerCounts } from './gameDetailsService.js';
import { steamPrice } from './gamesService.js';
import type { IgdbLookup } from './igdbLookup.js';
import { type IgdbGame, igdbImageUrl, toGameCard } from './igdbMappers.js';
import type { SteamSync } from './steamSync.js';
import type { SteamApp } from '../db/steamAppsRepository.js';

interface Deps {
  /** Ausente quando o banco não está disponível. */
  repo: RecommendationsRepository | null;
  igdb: IgdbClient;
  adult: AdultContentFilter;
  /** Opcionais: preço, demo e jogadores de cada jogo do placar. Sem eles, o placar segue sem esses dados. */
  lookup?: IgdbLookup;
  steam?: SteamSync | null;
  cache?: MemoryCache;
}

interface Extras {
  steamAppId: number | null;
  players: ReturnType<typeof playerCounts>;
  artwork: string | null;
  genres: string[];
}

interface IgdbExtras {
  id: number;
  multiplayer_modes?: Parameters<typeof playerCounts>[0];
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  genres?: { name: string }[];
}
const EXTRAS_TTL_MS = 60 * 60 * 1000;

export interface RecommendationsService {
  board(voter: string, adult: AdultMode): Promise<RecommendationBoard>;
  status(igdbId: number, voter: string): Promise<RecommendationStatus>;
  recommend(igdbId: number, voter: string): Promise<RecommendationStatus>;
  vote(igdbId: number, voter: string, kind: VoteKind, on: boolean): Promise<RecommendationStatus & { removed: boolean }>;
}

function toEntry(row: RecommendationRow): RecommendationEntry {
  return {
    hasDemo: false,
    players: null,
    game: toGameCard({
      id: row.igdbId,
      name: row.name,
      slug: row.slug,
      cover: row.coverImageId ? { image_id: row.coverImageId } : undefined,
    }),
    upvotes: row.upvotes,
    removeVotes: row.removeVotes,
    votedUp: row.votedUp,
    votedRemove: row.votedRemove,
    recommendedAt: row.recommendedAt.toISOString(),
  };
}

export function createRecommendationsService({ repo, igdb, adult, lookup, steam, cache }: Deps): RecommendationsService {
  /** App ID da Steam e jogadores (IGDB) de cada jogo; muda pouco, fica 1 h em cache. */
  async function extrasFor(ids: number[]): Promise<Map<number, Extras>> {
    const result = new Map<number, Extras>();
    const missing = ids.filter((id) => {
      const hit = cache?.get<Extras>(`rec-extras:${id}`);
      if (hit) result.set(id, hit);
      return !hit;
    });
    if (missing.length === 0) return result;
    try {
      const [steamIds, modes] = await Promise.all([
        lookup ? lookup.steamAppIdsFor(missing) : Promise.resolve(new Map<number, number>()),
        igdb.query<IgdbExtras>(
          'games',
          `fields multiplayer_modes.platform,multiplayer_modes.onlinemax,multiplayer_modes.onlinecoopmax,multiplayer_modes.offlinemax,multiplayer_modes.offlinecoopmax,artworks.image_id,screenshots.image_id,genres.name; where id = (${missing.join(',')}); limit 500;`,
        ),
      ]);
      const byId = new Map(modes.map((g) => [g.id, g]));
      for (const id of missing) {
        const game = byId.get(id);
        const wide = game?.artworks?.[0]?.image_id ?? game?.screenshots?.[0]?.image_id;
        const extras: Extras = {
          steamAppId: steamIds.get(id) ?? null,
          players: game ? playerCounts(game.multiplayer_modes) : null,
          artwork: wide ? igdbImageUrl(wide, '1080p') : null,
          genres: game?.genres?.map((g) => g.name) ?? [],
        };
        cache?.set(`rec-extras:${id}`, extras, EXTRAS_TTL_MS);
        result.set(id, extras);
      }
    } catch {
      // Sem os extras, o placar continua funcionando só com nome, capa e votos.
    }
    return result;
  }

  /** Acrescenta preço, "grátis", demo e jogadores às entradas do placar. */
  async function enrich(entries: RecommendationEntry[]): Promise<RecommendationEntry[]> {
    if (entries.length === 0) return entries;
    const extras = await extrasFor(entries.map((e) => e.game.id));
    const appIds = [...extras.values()].flatMap((x) => (x.steamAppId ? [x.steamAppId] : []));
    let apps = new Map<number, SteamApp>();
    if (steam && appIds.length) {
      try {
        steam.refresh(appIds).catch(() => {});
        apps = (await steam.read(appIds)).apps;
      } catch {
        // Segue sem preço.
      }
    }
    return entries.map((entry) => {
      const x = extras.get(entry.game.id);
      const app = x?.steamAppId ? apps.get(x.steamAppId) : undefined;
      return {
        ...entry,
        players: x?.players ?? null,
        artwork: x?.artwork ?? null,
        genres: x?.genres ?? [],
        hasDemo: Boolean(app?.found && !app.isFree && app.hasDemo),
        game: app?.found ? { ...entry.game, free: app.isFree, price: steamPrice(app) } : entry.game,
      };
    });
  }

  function requireRepo(): RecommendationsRepository {
    if (!repo) {
      throw new MissingConfigError(
        'DATABASE_URL',
        'As recomendações precisam do banco, que não está disponível no servidor.',
      );
    }
    return repo;
  }

  async function status(igdbId: number, voter: string): Promise<RecommendationStatus> {
    const row = await requireRepo().get(igdbId, voter);
    return { entry: row ? toEntry(row) : null, removeThreshold: REMOVE_THRESHOLD };
  }

  return {
    async board(voter, adultMode) {
      const rows = await requireRepo().list(voter);
      const adultIds = adultMode === 'hide' ? await adult.adultIgdbIds(rows.map((r) => r.igdbId)) : new Set<number>();
      // Ocultos continuam contando votos; só não aparecem para quem está com o filtro ligado.
      const visible = rows.filter((r) => !adultIds.has(r.igdbId));
      return {
        entries: await enrich(visible.map(toEntry)),
        removeThreshold: REMOVE_THRESHOLD,
        hidden: rows.length - visible.length,
      };
    },

    status,

    async recommend(igdbId, voter) {
      const repository = requireRepo();
      const existing = await repository.get(igdbId, voter);
      if (!existing) {
        const [game] = await igdb.query<IgdbGame>(
          'games',
          `fields name,slug,cover.image_id; where id = ${igdbId}; limit 1;`,
        );
        if (!game) throw new NotFoundError(`Jogo ${igdbId} não encontrado.`);
        await repository.recommend(
          { igdbId, name: game.name, slug: game.slug, coverImageId: game.cover?.image_id ?? null },
          voter,
        );
      } else if (!existing.votedUp) {
        // Recomendar o que já está no placar conta como apoio.
        await repository.setVote(igdbId, voter, 'up', true);
      }
      return status(igdbId, voter);
    },

    async vote(igdbId, voter, kind, on) {
      const outcome = await requireRepo().setVote(igdbId, voter, kind, on);
      if (outcome === 'not_found') throw new NotFoundError('Este jogo não está no placar de recomendações.');
      if (outcome === 'removed') return { entry: null, removeThreshold: REMOVE_THRESHOLD, removed: true };
      return { ...(await status(igdbId, voter)), removed: false };
    },
  };
}
