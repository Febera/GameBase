import { normalizeTitle } from './igdbLookup.js';

/**
 * Sufixos de edição: "GTA V Enhanced", "Skyrim Special Edition", "Portal 2: GOTY"...
 * Jogos com o mesmo nome base são versões do mesmo jogo.
 */
const EDITION_SUFFIX =
  /[\s:\-–—]*(?:(?:the\s+)?(?:enhanced|legacy|definitive|remastered|remaster|complete|deluxe|ultimate|special|anniversary|director'?s cut|game of the year|goty)(?:\s+edition)?|edition)$/i;

export function baseTitle(title: string): string {
  let current = title.trim();
  // Alguns nomes têm dois sufixos ("Ultimate Deluxe Edition").
  for (let i = 0; i < 3; i++) {
    const next = current.replace(EDITION_SUFFIX, '').trim();
    if (next === current || next.length === 0) break;
    current = next;
  }
  return normalizeTitle(current);
}

export interface DedupeItem {
  name: string;
  /** Tem imagem própria (capa ou arte)? */
  hasImage: boolean;
  /** Grátis, ou tem preço conhecido. */
  hasPrice: boolean;
  free: boolean | null;
  /** Popularidade para escolher o registro principal. */
  popularity: number;
}

/**
 * Junta registros repetidos e edições do mesmo jogo:
 * - mesmo nome base → fica um só (o que tem imagem e é mais popular);
 * - se o escolhido não tem preço e outro do grupo tem, o preço vem emprestado dele.
 * Devolve, para cada item mantido, de qual item (índice) vem o preço; a ordem original é preservada.
 */
export function dedupeEditions<T>(items: T[], view: (item: T) => DedupeItem): { item: T; priceFrom: T }[] {
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = baseTitle(view(item).name);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });

  const keep = new Map<number, number>(); // índice mantido → índice que fornece o preço
  for (const indexes of groups.values()) {
    const rank = (i: number) => {
      const v = view(items[i]!);
      // Imagem primeiro, depois popularidade, depois o que já vinha antes na lista.
      return [v.hasImage ? 1 : 0, v.popularity, -i] as const;
    };
    const best = [...indexes].sort((a, b) => {
      const [ia, pa, oa] = rank(a);
      const [ib, pb, ob] = rank(b);
      return ib - ia || pb - pa || ob - oa;
    })[0]!;
    const priced = view(items[best]!).hasPrice
      ? best
      : (indexes.find((i) => view(items[i]!).hasPrice) ?? best);
    keep.set(best, priced);
  }

  return items.flatMap((item, index) => {
    const from = keep.get(index);
    return from === undefined ? [] : [{ item, priceFrom: items[from]! }];
  });
}
