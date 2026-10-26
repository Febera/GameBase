import { MissingConfigError, UpstreamError } from '../lib/errors.js';

const BASE_URL = 'https://api.isthereanydeal.com';
/** ID da Steam na IsThereAnyDeal. */
export const ITAD_STEAM_SHOP_ID = 61;

export interface ItadMoney {
  amount: number;
  currency: string;
}

export interface ItadDealItem {
  id: string;
  slug: string;
  title: string;
  type: string | null;
  mature: boolean;
  assets?: { boxart?: string; banner300?: string };
  deal: {
    shop: { id: number; name: string };
    price: ItadMoney;
    regular: ItadMoney;
    cut: number;
    expiry: string | null;
    url: string;
  };
}

export interface ItadDealsPage {
  nextOffset: number;
  hasMore: boolean;
  list: ItadDealItem[];
}

export interface DealsQuery {
  offset: number;
  limit: number;
  country: string;
  minCut: number;
  maxCut: number;
  /** true inclui jogos marcados como adultos na IsThereAnyDeal. */
  mature: boolean;
}

export interface ItadClient {
  readonly configured: boolean;
  deals(query: DealsQuery): Promise<ItadDealsPage>;
  /** IDs da Steam ("app/123") para cada ID de jogo da IsThereAnyDeal. */
  steamIdsFor(itadIds: string[]): Promise<Record<string, string[] | null>>;
  /** Procura um jogo pelo título exato e diz se ele é marcado como adulto. */
  lookupByTitle(title: string): Promise<ItadLookup>;
  /** Procura um jogo pelo App ID da Steam. */
  lookupBySteamAppId(appId: number): Promise<ItadLookup>;
  /** Informações do jogo, incluindo avaliações (Steam, Metacritic...). */
  gameInfo(itadId: string): Promise<ItadGameInfo>;
  /** Menor preço de todos os tempos, com loja e data. */
  historyLow(itadIds: string[], country: string): Promise<ItadHistoryLow[]>;
  /** Mudanças de preço desde uma data (da mais recente para a mais antiga). */
  history(itadId: string, country: string, since: Date): Promise<ItadHistoryEntry[]>;
  /** IDs da ITAD a partir de App IDs da Steam ("app/123" → id ou null). */
  itadIdsForSteam(appIds: number[]): Promise<Record<string, string | null>>;
  /** Preços atuais (opcionalmente só de algumas lojas), e o menor preço histórico. */
  prices(itadIds: string[], country: string, shops?: number[]): Promise<ItadPrices[]>;
}

export interface ItadHistoryLow {
  id: string;
  low: {
    shop: { id: number; name: string };
    price: ItadMoney;
    regular: ItadMoney;
    cut: number;
    timestamp: string;
  } | null;
}

export interface ItadHistoryEntry {
  timestamp: string;
  shop: { id: number; name: string };
  deal: { price: ItadMoney; regular: ItadMoney; cut: number } | null;
}

export interface ItadGameInfo {
  id?: string;
  title?: string;
  mature?: boolean;
  appid?: number | null;
  releaseDate?: string | null;
  tags?: string[];
  developers?: { name: string }[];
  publishers?: { name: string }[];
  assets?: { boxart?: string; banner600?: string; banner400?: string; banner300?: string } | null;
  reviews?: { score: number | null; source: string; count: number | null; url: string }[];
}

export interface ItadLookup {
  found: boolean;
  id: string | null;
  mature: boolean;
}

export interface ItadPrices {
  id: string;
  historyLow?: { all?: ItadMoney | null; y1?: ItadMoney | null; m3?: ItadMoney | null } | null;
  deals: {
    shop: { id: number; name: string };
    price: ItadMoney;
    regular: ItadMoney;
    cut: number;
    drm?: { id: number; name: string }[];
    expiry?: string | null;
    url: string;
  }[];
}

export function createItadClient({
  apiKey,
  fetchFn = fetch,
}: {
  apiKey: string | undefined;
  fetchFn?: typeof fetch;
}): ItadClient {
  function requireKey(): string {
    if (!apiKey) {
      throw new MissingConfigError(
        'ITAD_API_KEY',
        'A chave da IsThereAnyDeal (ITAD_API_KEY) não está configurada no servidor.',
      );
    }
    return apiKey;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const key = requireKey();
    let res: Response;
    try {
      res = await fetchFn(`${BASE_URL}${path}`, {
        ...init,
        headers: { Accept: 'application/json', 'ITAD-API-Key': key, ...init.headers },
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new UpstreamError('itad', 0, `Sem conexão com a IsThereAnyDeal: ${reason}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new UpstreamError('itad', res.status, 'A IsThereAnyDeal recusou a chave. Confira ITAD_API_KEY.');
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new UpstreamError('itad', res.status, `A IsThereAnyDeal respondeu HTTP ${res.status}. ${detail}`.trim());
    }
    return (await res.json()) as T;
  }

  async function lookup(params: URLSearchParams): Promise<ItadLookup> {
    const body = await request<{ found: boolean; game?: { id?: string; mature?: boolean } }>(
      `/games/lookup/v1?${params}`,
    );
    return {
      found: Boolean(body.found && body.game?.id),
      id: body.game?.id ?? null,
      mature: Boolean(body.game?.mature),
    };
  }

  return {
    get configured() {
      return Boolean(apiKey);
    },

    deals({ offset, limit, country, minCut, maxCut, mature }) {
      // Filtros vão no corpo em JSON (forma documentada); na URL o formato do filtro é outro.
      return request<ItadDealsPage>('/deals/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          offset,
          limit,
          sort: '-cut',
          mature,
          filter: { cut: { min: minCut, max: maxCut } },
        }),
      });
    },

    steamIdsFor(itadIds) {
      return request<Record<string, string[] | null>>(
        `/lookup/shop/${ITAD_STEAM_SHOP_ID}/id/v1`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itadIds),
        },
      );
    },

    lookupByTitle(title) {
      return lookup(new URLSearchParams({ title }));
    },

    lookupBySteamAppId(appId) {
      return lookup(new URLSearchParams({ appid: String(appId) }));
    },

    historyLow(itadIds, country) {
      return request<ItadHistoryLow[]>(`/games/historylow/v1?${new URLSearchParams({ country })}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itadIds),
      });
    },

    history(itadId, country, since) {
      const params = new URLSearchParams({ id: itadId, country, since: since.toISOString() });
      return request<ItadHistoryEntry[]>(`/games/history/v2?${params}`);
    },

    gameInfo(itadId) {
      return request<ItadGameInfo>(`/games/info/v2?${new URLSearchParams({ id: itadId })}`);
    },

    itadIdsForSteam(appIds) {
      return request<Record<string, string | null>>(`/lookup/id/shop/${ITAD_STEAM_SHOP_ID}/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appIds.map((id) => `app/${id}`)),
      });
    },

    prices(itadIds, country, shops) {
      const params = new URLSearchParams({ country });
      if (shops?.length) params.set('shops', shops.join(','));
      return request<ItadPrices[]>(`/games/prices/v3?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itadIds),
      });
    },
  };
}
