import { describe, expect, it, vi } from 'vitest';
import { createIgdbClient } from '../src/clients/igdb.js';
import type { RateLimiter } from '../src/clients/rateLimiter.js';
import { UpstreamError } from '../src/lib/errors.js';
import { jsonResponse } from './helpers.js';

const passthrough: RateLimiter = { run: (task) => task() };

describe('createIgdbClient', () => {
  it('envia Client-ID, token e a consulta como texto', async () => {
    const fetchFn = vi.fn(async () => jsonResponse([{ id: 1 }]));
    const auth = { getToken: async () => 'tok', invalidate: vi.fn() };
    const igdb = createIgdbClient({
      clientId: 'cid',
      auth,
      limiter: passthrough,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(await igdb.query('games', 'fields name;')).toEqual([{ id: 1 }]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.igdb.com/v4/games');
    expect(init.body).toBe('fields name;');
    expect(init.headers).toMatchObject({ 'Client-ID': 'cid', Authorization: 'Bearer tok' });
  });

  it('renova o token e repete uma vez após 401', async () => {
    const responses = [jsonResponse({}, 401), jsonResponse([{ id: 2 }])];
    const fetchFn = vi.fn(async () => responses.shift()!);
    const auth = { getToken: vi.fn(async () => 'tok'), invalidate: vi.fn() };
    const igdb = createIgdbClient({
      clientId: 'cid',
      auth,
      limiter: passthrough,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(await igdb.query('games', 'x')).toEqual([{ id: 2 }]);
    expect(auth.invalidate).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('transforma outros erros em UpstreamError', async () => {
    const fetchFn = vi.fn(async () => new Response('Syntax error', { status: 400 }));
    const igdb = createIgdbClient({
      clientId: 'cid',
      auth: { getToken: async () => 'tok', invalidate: () => {} },
      limiter: passthrough,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const error = await igdb.query('games', 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(400);
    expect((error as UpstreamError).message).toContain('Syntax error');
  });
});
