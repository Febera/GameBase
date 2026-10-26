import type { AdultMode, Page } from '@rj/shared';

/** Item de lista com a marca de conteúdo adulto, guardado em cache antes do filtro. */
export interface Flagged<T> {
  item: T;
  adult: boolean;
}

/** Remove os itens adultos quando o modo é "hide". */
export function visible<T>(list: Flagged<T>[], mode: AdultMode): T[] {
  return (mode === 'hide' ? list.filter((entry) => !entry.adult) : list).map((entry) => entry.item);
}

export function paginate<T>(all: T[], offset: number, limit: number): Page<T> {
  const end = offset + limit;
  return {
    items: all.slice(offset, end),
    nextOffset: end < all.length ? end : null,
    total: all.length,
  };
}

/** Item de lista com o que mais é preciso para filtrar e ordenar com dados da Steam. */
export interface ListEntry<T> extends Flagged<T> {
  steamAppId: number | null;
  /** Avaliações na IGDB: desempate quando a Steam ainda não foi verificada. */
  igdbCount: number;
}
