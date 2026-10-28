import type { MemoryCache } from '../cache/memoryCache.js';
import { chunk, quote } from '../clients/apicalypse.js';
import { type IgdbClient, igdbMultiquery } from '../clients/igdb.js';

/**
 * Marcadores da IGDB para jogos com foco em conteúdo sexual:
 * o tema "Erotic" e a palavra-chave "eroge". Os IDs são buscados pelo slug,
 * em vez de ficarem fixos no código.
 */
const ADULT_THEME_SLUGS = ['erotic'];
const ADULT_KEYWORD_SLUGS = ['eroge'];
const MARKERS_TTL_MS = 24 * 60 * 60 * 1000;

interface Markers {
  themeIds: number[];
  keywordIds: number[];
}

export interface AdultContentFilter {
  /** Devolve quais dos IDs da IGDB são jogos com foco em conteúdo sexual. */
  adultIgdbIds(ids: number[]): Promise<Set<number>>;
  /**
   * A condição Apicalypse que marca um jogo como adulto, para embutir em outra consulta
   * (ex.: num /multiquery). null quando não há marcadores. Opcional.
   */
  adultCondition?(): Promise<string | null>;
}

export function createAdultContentFilter({
  igdb,
  cache,
}: {
  igdb: IgdbClient;
  cache: MemoryCache;
}): AdultContentFilter {
  function loadMarkers(): Promise<Markers> {
    return cache.getOrSet('adult:markers', MARKERS_TTL_MS, async () => {
      // Temas e palavras-chave numa requisição só.
      const result = await igdbMultiquery(igdb, [
        {
          name: 'themes',
          endpoint: 'themes',
          body: `fields id; where slug = (${ADULT_THEME_SLUGS.map(quote).join(',')}); limit 10;`,
        },
        {
          name: 'keywords',
          endpoint: 'keywords',
          body: `fields id; where slug = (${ADULT_KEYWORD_SLUGS.map(quote).join(',')}); limit 10;`,
        },
      ]);
      const ids = (rows: unknown[] | undefined) => ((rows ?? []) as { id: number }[]).map((r) => r.id);
      return { themeIds: ids(result.themes), keywordIds: ids(result.keywords) };
    });
  }

  async function adultCondition(): Promise<string | null> {
    const { themeIds, keywordIds } = await loadMarkers();
    const conditions = [
      themeIds.length ? `themes = (${themeIds.join(',')})` : null,
      keywordIds.length ? `keywords = (${keywordIds.join(',')})` : null,
    ].filter(Boolean);
    return conditions.length ? `(${conditions.join(' | ')})` : null;
  }

  return {
    adultCondition,

    async adultIgdbIds(ids) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return new Set();

      const condition = await adultCondition();
      if (!condition) return new Set();

      const found = new Set<number>();
      for (const part of chunk(unique, 500)) {
        const rows = await igdb.query<{ id: number }>(
          'games',
          `fields id; where id = (${part.join(',')}) & ${condition}; limit 500;`,
        );
        for (const row of rows) found.add(row.id);
      }
      return found;
    },
  };
}
