import { UpstreamError } from '../lib/errors.js';
import type { RateLimiter } from './rateLimiter.js';
import type { TokenProvider } from './twitchAuth.js';

export interface IgdbClient {
  /** Envia uma consulta Apicalypse para um endpoint da IGDB, como "games". */
  query<T>(endpoint: string, body: string): Promise<T[]>;
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

  return {
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
}
