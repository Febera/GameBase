import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import type { IgdbClient } from '../src/clients/igdb.js';
import { createAdultContentFilter } from '../src/services/adultContent.js';

describe('adultContentFilter', () => {
  it('busca os marcadores pelo slug e filtra por tema ou palavra-chave', async () => {
    const bodies: string[] = [];
    const igdb: IgdbClient = {
      query: vi.fn(async (endpoint: string, body: string) => {
        bodies.push(`${endpoint}: ${body}`);
        if (endpoint === 'themes') return [{ id: 42 }];
        if (endpoint === 'keywords') return [{ id: 777 }];
        return [{ id: 3 }];
      }) as IgdbClient['query'],
    };
    const filter = createAdultContentFilter({ igdb, cache: new MemoryCache() });

    const result = await filter.adultIgdbIds([1, 2, 3, 3]);
    expect([...result]).toEqual([3]);
    expect(bodies).toContain('themes: fields id; where slug = ("erotic"); limit 10;');
    expect(bodies).toContain('keywords: fields id; where slug = ("eroge"); limit 10;');
    expect(bodies.at(-1)).toContain('where id = (1,2,3) & (themes = (42) | keywords = (777))');

    // Marcadores ficam em cache: a segunda chamada só consulta os jogos.
    await filter.adultIgdbIds([4]);
    expect(igdb.query).toHaveBeenCalledTimes(4);
  });

  it('não consulta nada quando não há IDs', async () => {
    const igdb: IgdbClient = { query: vi.fn() as IgdbClient['query'] };
    const filter = createAdultContentFilter({ igdb, cache: new MemoryCache() });
    expect((await filter.adultIgdbIds([])).size).toBe(0);
    expect(igdb.query).not.toHaveBeenCalled();
  });
});
