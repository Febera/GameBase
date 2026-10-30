import type { SearchFilters } from '@rj/shared';
import { quote } from '../clients/apicalypse.js';
import { pcCondition } from './pcPlatform.js';
export { PC_PLATFORM_ID } from './pcPlatform.js';

export const ACCEPTED_GAME_TYPES = [0, 4, 8, 9, 10, 11];

export interface QueryContext {
  /** Agora, em segundos. */
  nowS: number;
  /** IDs de fonte da IGDB para as lojas pedidas (já resolvidos). */
  storeSourceIds: number[];
  /** Nome do campo de fonte em external_games ("external_game_source" ou o antigo "category"). */
  sourceField: string;
}

export interface BuiltQuery {
  /** Texto para `search`, quando a ordem é por relevância. */
  search: string | null;
  where: string;
  sort: string | null;
}

const yearStart = (year: number) => Math.floor(Date.UTC(year, 0, 1) / 1000);

/** Monta a consulta Apicalypse a partir dos filtros. Função pura, para ser testada isoladamente. */
export function buildSearchQuery(filters: SearchFilters, ctx: QueryContext): BuiltQuery {
  const conditions = [pcCondition(ctx.sourceField), `game_type = (${ACCEPTED_GAME_TYPES.join(',')})`];
  const q = filters.q?.trim();
  // Sem texto, "relevância" não faz sentido: vira "mais populares".
  const sort = filters.sort === 'relevance' && !q ? 'popular' : (filters.sort ?? (q ? 'relevance' : 'popular'));

  if (filters.players && filters.players > 1) {
    const n = filters.players;
    const playerCondition =
      filters.mode === 'coop'
        ? `multiplayer_modes.onlinecoopmax >= ${n}`
        : `(multiplayer_modes.onlinemax >= ${n} | multiplayer_modes.onlinecoopmax >= ${n})`;
    conditions.push(filters.unknownPlayers ? `(${playerCondition} | multiplayer_modes = null)` : playerCondition);
  }
  if (filters.genres?.length) conditions.push(`genres = (${filters.genres.join(',')})`);
  if (filters.yearMin) conditions.push(`first_release_date >= ${yearStart(filters.yearMin)}`);
  if (filters.yearMax) conditions.push(`first_release_date < ${yearStart(filters.yearMax + 1)}`);
  if (filters.ratingMin) conditions.push(`total_rating >= ${filters.ratingMin}`);
  if (ctx.storeSourceIds.length) {
    conditions.push(`external_games.${ctx.sourceField} = (${ctx.storeSourceIds.join(',')})`);
  }

  if (q && sort !== 'relevance') conditions.push(`name ~ *${quote(q)}*`);
  if (sort === 'recent') conditions.push(`first_release_date <= ${ctx.nowS}`);
  // "Mais bem avaliados": a janela traz os mais avaliados da IGDB (populares) e o serviço
  // reordena pela média bayesiana das avaliações da Steam (ver bayesianRank).
  if (sort === 'rating') conditions.push('total_rating_count >= 5');

  const sortClause = {
    relevance: null,
    popular: 'total_rating_count desc',
    rating: 'total_rating_count desc',
    recent: 'first_release_date desc',
  }[sort];

  return {
    search: q && sort === 'relevance' ? q : null,
    where: conditions.join(' & '),
    sort: sortClause,
  };
}
