import { describe, expect, it } from 'vitest';
import { QUICK_SEARCHES } from './quickSearches';
import { toSearchParams } from './searchParams';

describe('buscas rápidas', () => {
  it('viram links de busca com os filtros certos', () => {
    const urls = Object.fromEntries(QUICK_SEARCHES.map((q) => [q.key, toSearchParams(q.filters, 'list').toString()]));
    expect(urls).toEqual({
      coop4: 'jogadores=4&modo=coop',
      online8: 'jogadores=8',
      free: 'preco=gratis',
      demo: 'preco=demo',
      recent: 'ordem=recent',
      rated: 'ordem=rating',
    });
  });
});
