import { describe, expect, it, vi } from 'vitest';
import { createIgdbClient, type IgdbClient, igdbMultiquery } from '../src/clients/igdb.js';
import { createAdultContentFilter } from '../src/services/adultContent.js';
import { MemoryCache } from '../src/cache/memoryCache.js';
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

describe('multiquery', () => {
  const auth = { getToken: async () => 'tok', invalidate: vi.fn() };

  it('envia várias consultas numa requisição e separa os resultados pelo nome', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse([
        { name: 'b', result: [{ id: 2 }] },
        { name: 'a', result: [{ id: 1 }] },
      ]),
    );
    const igdb = createIgdbClient({ clientId: 'cid', auth, limiter: passthrough, fetchFn: fetchFn as unknown as typeof fetch });
    const result = await igdbMultiquery(igdb, [
      { name: 'a', endpoint: 'games', body: 'fields id; where id = 1;' },
      { name: 'b', endpoint: 'themes', body: 'fields id;' },
      { name: 'c', endpoint: 'games', body: 'fields id; where id = 3;' },
    ]);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.igdb.com/v4/multiquery');
    expect(init.body).toContain('query games "a" { fields id; where id = 1; };');
    expect(init.body).toContain('query themes "b" { fields id; };');
    expect(result).toEqual({ a: [{ id: 1 }], b: [{ id: 2 }], c: [] });
  });

  it('mais de 10 consultas: divide em requisições de até 10', async () => {
    const calls: string[] = [];
    const igdb: IgdbClient = {
      query: async () => [],
      multiquery: async (queries) => (calls.push(queries.map((q) => q.name).join()), Object.fromEntries(queries.map((q) => [q.name, [q.name]]))),
    };
    const queries = Array.from({ length: 12 }, (_, i) => ({ name: `q${i}`, endpoint: 'games', body: '' }));
    const result = await igdbMultiquery(igdb, queries);
    expect(calls).toHaveLength(2);
    expect(Object.keys(result)).toHaveLength(12);
  });

  it('cliente sem multiquery: uma consulta por vez, em paralelo, mesmo resultado', async () => {
    const query = vi.fn(async (endpoint: string) => [{ endpoint }]);
    const result = await igdbMultiquery({ query } as unknown as IgdbClient, [
      { name: 'x', endpoint: 'themes', body: '' },
      { name: 'y', endpoint: 'keywords', body: '' },
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ x: [{ endpoint: 'themes' }], y: [{ endpoint: 'keywords' }] });
  });

  it('filtro de conteúdo adulto busca temas e palavras-chave numa requisição só', async () => {
    const multiquery = vi.fn(async () => ({ themes: [{ id: 42 }], keywords: [{ id: 7 }] }));
    const query = vi.fn(async () => [{ id: 5 }]);
    const adult = createAdultContentFilter({ igdb: { query, multiquery } as unknown as IgdbClient, cache: new MemoryCache() });
    expect(await adult.adultCondition?.()).toBe('(themes = (42) | keywords = (7))');
    expect([...(await adult.adultIgdbIds([5, 6]))]).toEqual([5]);
    expect(multiquery).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith('games', expect.stringContaining('& (themes = (42) | keywords = (7))'));
  });
});
