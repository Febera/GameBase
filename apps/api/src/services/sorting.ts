import type { ListSort, SortOrder } from '@rj/shared';

/** Mínimo de avaliações na Steam para entrar em "Mais bem avaliados" (e peso da média). */
export const MIN_RATED_REVIEWS = 500;

/**
 * Ordena por média bayesiana das avaliações da Steam: quem tem poucas avaliações é puxado para
 * a média geral, então 98% com 600 avaliações não passa de 95% com 80 mil. Fórmula:
 * (v / (v + m)) · R + (m / (v + m)) · C, com R = % positivas, v = total de avaliações,
 * m = MIN_RATED_REVIEWS e C = % média da lista. Fica de fora quem tem menos de m avaliações.
 */
export function bayesianRank<T>(list: T[], reviewsOf: (item: T) => { percent: number; total: number } | null | undefined): T[] {
  const m = MIN_RATED_REVIEWS;
  const eligible = list.flatMap((item, index) => {
    const r = reviewsOf(item);
    return r && r.total >= m ? [{ item, index, r }] : [];
  });
  if (eligible.length === 0) return [];
  const mean = eligible.reduce((sum, e) => sum + e.r.percent, 0) / eligible.length;
  return eligible
    .map((e) => ({ ...e, score: (e.r.total / (e.r.total + m)) * e.r.percent + (m / (e.r.total + m)) * mean }))
    .sort((a, b) => b.score - a.score || b.r.total - a.r.total || a.index - b.index)
    .map((e) => e.item);
}

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
