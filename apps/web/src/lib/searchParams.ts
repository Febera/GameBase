import type { NewGamesCategory, SearchFilters, SearchSort } from '@rj/shared';

export type ResultsView = 'list' | 'grid';

/** Nomes curtos e em português na URL, para o link ser legível ao compartilhar. */
const KEYS = {
  q: 'q',
  sort: 'ordem',
  players: 'jogadores',
  mode: 'modo',
  unknownPlayers: 'seminfo',
  showDuplicates: 'duplicatas',
  prices: 'preco',
  stores: 'lojas',
  genres: 'generos',
  yearMin: 'de',
  yearMax: 'ate',
  ratingMin: 'nota',
  view: 'visao',
} as const;

const SORTS: SearchSort[] = ['relevance', 'popular', 'rating', 'recent'];

/** Faixas de preço na URL, em português. */
const PRICE_TO_URL: Record<NewGamesCategory, string> = { free: 'gratis', demo: 'demo', paid: 'pago' };
const PRICE_FROM_URL = Object.fromEntries(
  Object.entries(PRICE_TO_URL).map(([k, v]) => [v, k]),
) as Record<string, NewGamesCategory>;
export const ALL_PRICES: NewGamesCategory[] = ['free', 'demo', 'paid'];

const int = (value: string | null) => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function parseSearch(params: URLSearchParams): { filters: SearchFilters; view: ResultsView } {
  const sort = params.get(KEYS.sort) as SearchSort | null;
  const list = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);
  const filters: SearchFilters = {
    q: params.get(KEYS.q)?.trim() || undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    players: int(params.get(KEYS.players)),
    mode: params.get(KEYS.mode) === 'coop' ? 'coop' : undefined,
    unknownPlayers: params.get(KEYS.unknownPlayers) === '1' || undefined,
    showDuplicates: params.get(KEYS.showDuplicates) === '1' || undefined,
    prices: list(KEYS.prices).flatMap((v) => (PRICE_FROM_URL[v] ? [PRICE_FROM_URL[v]!] : [])),
    stores: list(KEYS.stores),
    genres: list(KEYS.genres).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    yearMin: int(params.get(KEYS.yearMin)),
    yearMax: int(params.get(KEYS.yearMax)),
    ratingMin: int(params.get(KEYS.ratingMin)),
  };
  return { filters, view: params.get(KEYS.view) === 'grade' ? 'grid' : 'list' };
}

export function toSearchParams(filters: SearchFilters, view: ResultsView): URLSearchParams {
  const p = new URLSearchParams();
  const set = (key: string, value: string | number | undefined | false) => {
    if (value !== undefined && value !== false && value !== '') p.set(key, String(value));
  };
  set(KEYS.q, filters.q);
  set(KEYS.sort, filters.sort);
  set(KEYS.players, filters.players);
  set(KEYS.mode, filters.mode === 'coop' ? 'coop' : undefined);
  set(KEYS.unknownPlayers, filters.unknownPlayers && filters.players ? '1' : undefined);
  set(KEYS.showDuplicates, filters.showDuplicates ? '1' : undefined);
  set(KEYS.prices, filters.prices?.map((p) => PRICE_TO_URL[p]).join(','));
  set(KEYS.stores, filters.stores?.join(','));
  set(KEYS.genres, filters.genres?.join(','));
  set(KEYS.yearMin, filters.yearMin);
  set(KEYS.yearMax, filters.yearMax);
  set(KEYS.ratingMin, filters.ratingMin);
  set(KEYS.view, view === 'grid' ? 'grade' : undefined);
  return p;
}

/** Quantos filtros (além do texto e da ordem) estão ativos. */
export function activeFilterCount(f: SearchFilters): number {
  return [
    f.players,
    f.prices?.length,
    f.stores?.length,
    f.genres?.length,
    f.yearMin,
    f.yearMax,
    f.ratingMin,
  ].filter(Boolean).length;
}

/** Parâmetros no formato da API (nomes em inglês, listas separadas por vírgula). */
export function toApiParams(filters: SearchFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === false || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) out[key] = value.join(',');
    } else {
      out[key] = typeof value === 'boolean' ? '1' : value;
    }
  }
  if (!filters.players) delete out.unknownPlayers;
  return out;
}
