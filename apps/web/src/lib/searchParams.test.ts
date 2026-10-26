import { describe, expect, it } from 'vitest';
import { activeFilterCount, parseSearch, toApiParams, toSearchParams } from './searchParams';

describe('searchParams', () => {
  it('ida e volta entre filtros e URL', () => {
    const filters = {
      q: 'portal',
      sort: 'rating' as const,
      players: 4,
      mode: 'coop' as const,
      unknownPlayers: true,
      prices: ['free' as const, 'demo' as const],
      stores: ['steam', 'epic'],
      genres: [5, 12],
      yearMin: 2020,
      ratingMin: 80,
    };
    const params = toSearchParams(filters, 'grid');
    expect(params.toString()).toBe(
      'q=portal&ordem=rating&jogadores=4&modo=coop&seminfo=1&preco=gratis%2Cdemo&lojas=steam%2Cepic&generos=5%2C12&de=2020&nota=80&visao=grade',
    );
    const back = parseSearch(params);
    expect(back.view).toBe('grid');
    expect(back.filters).toMatchObject(filters);
  });

  it('ignora valores inválidos e "sem informação" sem jogadores', () => {
    const { filters, view } = parseSearch(new URLSearchParams('ordem=xyz&jogadores=abc&generos=a,3&seminfo=1'));
    expect(filters.sort).toBeUndefined();
    expect(filters.players).toBeUndefined();
    expect(filters.genres).toEqual([3]);
    expect(view).toBe('list');
    expect(toApiParams(filters)).toEqual({ genres: '3' });
  });

  it('converte para a API e conta filtros ativos', () => {
    expect(toApiParams({ q: 'x', players: 3, prices: ['paid'], stores: [] })).toEqual({ q: 'x', players: 3, prices: 'paid' });
    expect(activeFilterCount({ q: 'x', sort: 'recent', players: 3, stores: ['gog'] })).toBe(2);
  });
});
