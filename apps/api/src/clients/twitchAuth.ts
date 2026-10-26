import { UpstreamError } from '../lib/errors.js';
import { type Clock, systemClock } from '../lib/time.js';

export interface TokenProvider {
  getToken(): Promise<string>;
  /** Descarta o token atual (por exemplo, depois de um 401). */
  invalidate(): void;
}

interface Options {
  clientId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
  now?: Clock;
}

/** Renova antes de expirar para não usar um token prestes a vencer. */
const RENEW_MARGIN_MS = 5 * 60 * 1000;

/**
 * Token de aplicativo da Twitch (client credentials), exigido pela IGDB.
 * Guarda o token em memória e só pede outro quando estiver perto de expirar.
 */
export function createTwitchAuth({
  clientId,
  clientSecret,
  fetchFn = fetch,
  now = systemClock,
}: Options): TokenProvider {
  let cached: { token: string; expiresAt: number } | null = null;
  let inflight: Promise<string> | null = null;

  async function requestToken(): Promise<string> {
    const url = new URL('https://id.twitch.tv/oauth2/token');
    url.search = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString();

    let res: Response;
    try {
      res = await fetchFn(url, { method: 'POST' });
    } catch (cause) {
      throw new UpstreamError('twitch', 0, `Sem conexão com a Twitch: ${describe(cause)}`);
    }
    if (!res.ok) {
      throw new UpstreamError(
        'twitch',
        res.status,
        `A Twitch recusou as credenciais (HTTP ${res.status}). Confira TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no .env.`,
      );
    }
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cached = {
      token: body.access_token,
      expiresAt: now() + body.expires_in * 1000 - RENEW_MARGIN_MS,
    };
    return body.access_token;
  }

  return {
    async getToken() {
      if (cached && cached.expiresAt > now()) return cached.token;
      inflight ??= requestToken().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    invalidate() {
      cached = null;
    },
  };
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
