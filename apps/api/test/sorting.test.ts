import { describe, expect, it } from 'vitest';
import { bayesianRank } from '../src/services/sorting.js';

describe('bayesianRank', () => {
  it('puxa quem tem poucas avaliações para a média e tira quem tem menos de 500', () => {
    const games = [
      { id: 'pouco', r: { percent: 98, total: 600 } },
      { id: 'muito', r: { percent: 95, total: 100_000 } },
      { id: 'raro', r: { percent: 100, total: 499 } },
      { id: 'medio', r: { percent: 80, total: 5_000 } },
      { id: 'sem', r: null },
    ];
    expect(bayesianRank(games, (g) => g.r).map((g) => g.id)).toEqual(['muito', 'pouco', 'medio']);
  });

  it('lista vazia quando ninguém tem avaliações suficientes', () => {
    expect(bayesianRank([{ r: { percent: 100, total: 10 } }], (g) => g.r)).toEqual([]);
  });
});
