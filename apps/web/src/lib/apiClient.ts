import type {
  AdultMode,
  ApiErrorBody,
  DealCard,
  GameCard,
  GameDetails,
  GiveawayCard,
  ListSort,
  NewGamesCategory,
  OfferDetails,
  Page,
  RecommendationBoard,
  RecommendationStatus,
  SearchFacets,
  SearchFilters,
  SearchResult,
  SearchSuggestion,
  SortOrder,
  VoteKind,
} from '@rj/shared';

/** Ordenação das listas da home. */
export interface ListOrder {
  sort: ListSort;
  order: SortOrder;
}
export const DEFAULT_ORDER: ListOrder = { sort: 'reviews', order: 'desc' };
import { toApiParams } from './searchParams';

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Código de erro da API, como "adult_content". */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  return send<T>('GET', path, params);
}

async function send<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  let res: Response;
  try {
    res = await fetch(url, { method });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Ele pode estar fora do ar ou acordando.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null;
    throw new ApiError(res.status, body?.message ?? `O servidor respondeu com erro ${res.status}.`, body?.error);
  }
  return (await res.json()) as T;
}

export const api = {
  newPopular: (offset: number, limit: number, adult: AdultMode, category: NewGamesCategory, o = DEFAULT_ORDER) =>
    get<Page<GameCard>>('/api/games/new-popular', { offset, limit, adult, category, ...o }),
  giveaways: (offset: number, limit: number, adult: AdultMode, o = DEFAULT_ORDER) =>
    get<Page<GiveawayCard>>('/api/giveaways', { offset, limit, adult, ...o }),
  search: (filters: SearchFilters, offset: number, limit: number, adult: AdultMode) =>
    get<Page<SearchResult>>('/api/search', { ...toApiParams(filters), offset, limit, adult }),
  suggest: (q: string, adult: AdultMode) => get<SearchSuggestion[]>('/api/search/suggest', { q, adult }),
  facets: () => get<SearchFacets>('/api/search/facets'),
  recommendations: (adult: AdultMode) => get<RecommendationBoard>('/api/recommendations', { adult }),
  recommendation: (id: number) => get<RecommendationStatus>(`/api/recommendations/${id}`),
  recommend: (id: number) => send<RecommendationStatus>('POST', `/api/recommendations/${id}`),
  vote: (id: number, kind: VoteKind, on: boolean) =>
    send<RecommendationStatus & { removed: boolean }>(on ? 'PUT' : 'DELETE', `/api/recommendations/${id}/votes/${kind}`),
  offer: (id: string, adult: AdultMode) => get<OfferDetails>(`/api/offers/${id}`, { adult }),
  game: (id: number, adult: AdultMode) => get<GameDetails>(`/api/games/${id}`, { adult }),
  deals: (offset: number, limit: number, adult: AdultMode, o = DEFAULT_ORDER) =>
    get<Page<DealCard>>('/api/deals', { offset, limit, adult, ...o }),
};
