import type { ListSort, SortOrder } from '@rj/shared';

/** O que cada item oferece para ser ordenado. */
export interface SortKeys {
  reviews: number | null;
  discount: number | null;
  value: number | null;
  /** AAAA-MM-DD */
  release: string | null;
}

/**
 * Ordena uma lista mantendo a ordem original como desempate (sort estável).
 * Itens sem o valor ficam sempre no fim, em qualquer direção.
 */
export function sortBy<T>(list: T[], keysOf: (item: T) => SortKeys, sort: ListSort, order: SortOrder): T[] {
  const dir = order === 'asc' ? 1 : -1;
  return list
    .map((item, index) => ({ item, index, key: keysOf(item)[sort] }))
    .sort((a, b) => {
      if (a.key === null && b.key === null) return a.index - b.index;
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      const diff = typeof a.key === 'string' ? a.key.localeCompare(b.key as string) : a.key - (b.key as number);
      return diff !== 0 ? diff * dir : a.index - b.index;
    })
    .map((entry) => entry.item);
}
