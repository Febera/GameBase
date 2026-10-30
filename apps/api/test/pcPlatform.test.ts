import { describe, expect, it } from 'vitest';
import { pcCondition } from '../src/services/pcPlatform.js';
import { buildSearchQuery } from '../src/services/searchQuery.js';

describe('jogo de PC', () => {
  it('aceita jogo com plataforma PC ou com página na Steam', () => {
    expect(pcCondition()).toBe('(platforms = (6) | external_games.external_game_source = 1)');
    // API antiga da IGDB: o campo da fonte se chamava "category".
    expect(pcCondition('category')).toBe('(platforms = (6) | external_games.category = 1)');
  });

  it('busca: cadastro sem plataforma, mas com página na Steam (ex.: Thalassomania, ainda não lançado), entra', () => {
    const q = buildSearchQuery({ q: 'thalassomania' }, { nowS: 0, storeSourceIds: [], sourceField: 'external_game_source' });
    expect(q.where).toContain('(platforms = (6) | external_games.external_game_source = 1)');
    expect(q.where).not.toMatch(/(^|& )platforms = \(6\)( &|$)/); // a exigência antiga, sozinha, não existe mais
  });

  it('busca com filtro de loja na API antiga usa "category" também na regra de PC', () => {
    const q = buildSearchQuery({ stores: ['steam'] }, { nowS: 0, storeSourceIds: [1], sourceField: 'category' });
    expect(q.where).toContain('(platforms = (6) | external_games.category = 1)');
  });
});
