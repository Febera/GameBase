import { UpstreamError } from '../lib/errors.js';
import type { RateLimiter } from './rateLimiter.js';
import type { TokenProvider } from './twitchAuth.js';

export interface IgdbClient {
  /** Envia uma consulta Apicalypse para um endpoint da IGDB, como "games". */
  query<T>(endpoint: string, body: string): Promise<T[]>;
  /** Até 10 consultas numa requisição só (endpoint /multiquery). Opcional: ver igdbMultiquery. */
  multiquery?(queries: IgdbNamedQuery[]): Promise<Record<string, unknown[]>>;
}

export interface IgdbNamedQuery {
  /** Nome do resultado (letras, números e _). */
  name: string;
  endpoint: string;
  body: string;
}

/** Máximo de consultas por /multiquery, pela documentação da IGDB. */
export const MULTIQUERY_MAX = 10;

/** Monta o corpo do /multiquery: `query games "nome" { ... };` para cada consulta. */
export function multiqueryBody(queries: IgdbNamedQuery[]): string {
  return queries.map((q) => `query ${q.endpoint} "${q.name}" { ${q.body} };`).join('\n');
}

/**
 * Várias consultas de uma vez: numa requisição só quando o cliente tem multiquery (a IGDB
 * limita a 4 requisições por segundo), senão em paralelo, uma por consulta.
 */
export async function igdbMultiquery(igdb: IgdbClient, queries: IgdbNamedQuery[]): Promise<Record<string, unknown[]>> {
  if (queries.length === 0) return {};
  if (igdb.multiquery && queries.length > 1) {
    const result: Record<string, unknown[]> = {};
    for (let i = 0; i < queries.length; i += MULTIQUERY_MAX) {
      Object.assign(result, await igdb.multiquery(queries.slice(i, i + MULTIQUERY_MAX)));
    }
    return result;
  }
  const results = await Promise.all(queries.map((q) => igdb.query<unknown>(q.endpoint, q.body)));
  return Object.fromEntries(queries.map((q, i) => [q.name, results[i]!]));
}

interface Options {
  clientId: string;
  auth: TokenProvider;
  limiter: RateLimiter;
  fetchFn?: typeof fetch;
}

const BASE_URL = 'https://api.igdb.com/v4';

export function createIgdbClient({ clientId, auth, limiter, fetchFn = fetch }: Options): IgdbClient {
  async function send(endpoint: string, body: string, token: string): Promise<Response> {
    try {
      return await fetchFn(`${BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'text/plain',
        },
        body,
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new UpstreamError('igdb', 0, `Sem conexão com a IGDB: ${reason}`);
    }
  }

  const client: IgdbClient = {
    async multiquery(queries) {
      const rows = await client.query<{ name: string; result?: unknown[] }>('multiquery', multiqueryBody(queries));
      const result: Record<string, unknown[]> = {};
      for (const q of queries) result[q.name] = rows.find((r) => r.name === q.name)?.result ?? [];
      return result;
    },

    query<T>(endpoint: string, body: string) {
      return limiter.run(async () => {
        let res = await send(endpoint, body, await auth.getToken());

        // Token revogado ou expirado antes do previsto: renova uma vez e tenta de novo.
        if (res.status === 401) {
          auth.invalidate();
          res = await send(endpoint, body, await auth.getToken());
        }

        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).slice(0, 300);
          throw new UpstreamError(
            'igdb',
            res.status,
            `A IGDB respondeu HTTP ${res.status} em /${endpoint}. ${detail}`.trim(),
          );
        }
        return (await res.json()) as T[];
      });
    },
  };
  return client;
}
