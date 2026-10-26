import { describe, expect, it } from 'vitest';
import { baseTitle, dedupeEditions, type DedupeItem } from '../src/services/dedupe.js';
import { sortBy } from '../src/services/sorting.js';

describe('baseTitle', () => {
  it('remove sufixos de edição, inclusive dois seguidos', () => {
    expect(baseTitle('Grand Theft Auto V Enhanced')).toBe(baseTitle('Grand Theft Auto V'));
    expect(baseTitle('The Elder Scrolls V: Skyrim Special Edition')).toBe(baseTitle('The Elder Scrolls V: Skyrim'));
    expect(baseTitle('Jogo - Ultimate Deluxe Edition')).toBe('jogo');
    expect(baseTitle('Portal 2: GOTY')).toBe('portal 2');
    // Não mexe em nomes que só contêm a palavra no meio.
    expect(baseTitle('Legacy of Kain')).toBe('legacy of kain');
  });
});

describe('dedupeEditions', () => {
  const v = (name: string, extra: Partial<DedupeItem> = {}): DedupeItem => ({
    name,
    hasImage: true,
    hasPrice: true,
    free: false,
    popularity: 0,
    ...extra,
  });

  it('GTA V: mantém o registro com imagem e pega o preço da edição Enhanced', () => {
    const items = [
      v('Grand Theft Auto V', { hasPrice: false, popularity: 5000 }),
      v('Outro Jogo'),
      v('Grand Theft Auto V Enhanced', { hasImage: false, popularity: 10 }),
    ];
    const result = dedupeEditions(items, (x) => x);
    expect(result.map((r) => r.item.name)).toEqual(['Grand Theft Auto V', 'Outro Jogo']);
    expect(result[0]?.priceFrom.name).toBe('Grand Theft Auto V Enhanced');
  });

  it('nomes iguais: fica o mais popular', () => {
    const items = [v('Overwatch', { popularity: 10 }), v('Overwatch', { popularity: 900 })];
    const result = dedupeEditions(items, (x) => x);
    expect(result).toHaveLength(1);
    expect(result[0]?.item.popularity).toBe(900);
  });
});

describe('sortBy', () => {
  const list = [
    { id: 'a', reviews: 10, discount: 50, value: null, release: '2020-01-01' },
    { id: 'b', reviews: null, discount: 90, value: 20, release: null },
    { id: 'c', reviews: 300, discount: 50, value: 10, release: '2024-05-01' },
  ];
  const keys = (x: (typeof list)[number]) => ({ reviews: x.reviews, discount: x.discount, value: x.value, release: x.release });

  it('ordena nos dois sentidos com os sem valor no fim', () => {
    expect(sortBy(list, keys, 'reviews', 'desc').map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(sortBy(list, keys, 'reviews', 'asc').map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(sortBy(list, keys, 'release', 'desc').map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('empate mantém a ordem original', () => {
    expect(sortBy(list, keys, 'discount', 'asc').map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });
});
