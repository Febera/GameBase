import type { MemoryCache } from '../cache/memoryCache.js';
import { chunk, quote } from '../clients/apicalypse.js';
import type { IgdbClient } from '../clients/igdb.js';

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
      const [themes, keywords] = await Promise.all([
        igdb.query<{ id: number }>(
          'themes',
          `fields id; where slug = (${ADULT_THEME_SLUGS.map(quote).join(',')}); limit 10;`,
        ),
        igdb.query<{ id: number }>(
          'keywords',
          `fields id; where slug = (${ADULT_KEYWORD_SLUGS.map(quote).join(',')}); limit 10;`,
        ),
      ]);
      return { themeIds: themes.map((t) => t.id), keywordIds: keywords.map((k) => k.id) };
    });
  }

  return {
    async adultIgdbIds(ids) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return new Set();

      const { themeIds, keywordIds } = await loadMarkers();
      const conditions = [
        themeIds.length ? `themes = (${themeIds.join(',')})` : null,
        keywordIds.length ? `keywords = (${keywordIds.join(',')})` : null,
      ].filter(Boolean);
      if (conditions.length === 0) return new Set();

      const found = new Set<number>();
      for (const part of chunk(unique, 500)) {
        const rows = await igdb.query<{ id: number }>(
          'games',
          `fields id; where id = (${part.join(',')}) & (${conditions.join(' | ')}); limit 500;`,
        );
        for (const row of rows) found.add(row.id);
      }
      return found;
    },
  };
}
