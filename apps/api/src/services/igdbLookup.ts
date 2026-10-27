import { chunk, quote } from '../clients/apicalypse.js';
import type { IgdbClient } from '../clients/igdb.js';
import { UpstreamError } from '../lib/errors.js';
import { CARD_FIELDS, type IgdbGame } from './igdbMappers.js';

const PC_PLATFORM_ID = 6;
/** Fonte "Steam" na tabela external_games da IGDB. */
const STEAM_SOURCE = 1;

/** Normaliza um nome para comparar títulos de fontes diferentes. */
export function normalizeTitle(title: string): string {
  return title
    .replace(/[™®©]/g, '') // antes do NFKD, que transformaria "™" em "TM"
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Prefere o registro mais conhecido quando há vários jogos com o mesmo nome. */
function better(a: IgdbGame | undefined, b: IgdbGame): IgdbGame {
  if (!a) return b;
  return (b.total_rating_count ?? 0) > (a.total_rating_count ?? 0) ? b : a;
}

export interface IgdbLookup {
  /** Jogos de PC cujo nome é igual (sem diferenciar maiúsculas) a algum dos títulos. */
  byTitles(titles: string[]): Promise<Map<string, IgdbGame>>;
  /** Jogos da IGDB vinculados a cada App ID da Steam. */
  bySteamAppIds(appIds: string[]): Promise<Map<string, IgdbGame>>;
  /** App ID da Steam de cada jogo da IGDB (quando existe). */
  steamAppIdsFor(igdbIds: number[]): Promise<Map<number, number>>;
}

export function createIgdbLookup(igdb: IgdbClient): IgdbLookup {
  /** Consulta external_games da Steam, caindo para o campo antigo se a IGDB recusar o novo. */
  async function steamExternal<T>(fields: string, where: string): Promise<T[]> {
    // Um jogo pode ter vários vínculos com a Steam (edições, relançamentos): a resposta pode
    // passar de 500 linhas, o máximo da IGDB. Pagina até vir uma página incompleta.
    const query = async (source: string) => {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await igdb.query<T>(
          'external_games',
          `fields ${fields}; where ${source} = ${STEAM_SOURCE} & ${where}; sort id asc; limit 500; offset ${offset};`,
        );
        rows.push(...page);
        if (page.length < 500 || offset >= 4500) return rows;
      }
    };
    try {
      return await query('external_game_source');
    } catch (error) {
      if (!(error instanceof UpstreamError) || error.status !== 400) throw error;
      return query('category');
    }
  }

  return {
    async byTitles(titles) {
      const result = new Map<string, IgdbGame>();
      const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
      for (const part of chunk(unique, 40)) {
        const names = part.map((t) => `name ~ ${quote(t)}`).join(' | ');
        const games = await igdb.query<IgdbGame>(
          'games',
          `fields ${CARD_FIELDS}; where (${names}) & platforms = (${PC_PLATFORM_ID}); limit 500;`,
        );
        for (const game of games) {
          const key = normalizeTitle(game.name);
          result.set(key, better(result.get(key), game));
        }
      }
      return result;
    },

    async steamAppIdsFor(igdbIds) {
      const result = new Map<number, number>();
      for (const part of chunk([...new Set(igdbIds)], 500)) {
        const rows = await steamExternal<{ uid: string; game: number }>('uid,game', `game = (${part.join(',')})`);
        for (const row of rows) {
          const appId = Number(row.uid);
          // Um jogo pode ter vários vínculos (edições); fica o primeiro número válido.
          if (Number.isInteger(appId) && appId > 0 && !result.has(row.game)) result.set(row.game, appId);
        }
      }
      return result;
    },

    async bySteamAppIds(appIds) {
      const result = new Map<string, IgdbGame>();
      for (const part of chunk([...new Set(appIds)], 300)) {
        const gameFields = CARD_FIELDS.split(',').map((f) => `game.${f}`).join(',');
        const rows = await steamExternal<{ uid: string; game?: IgdbGame }>(
          `uid,game.id,${gameFields}`,
          `uid = (${part.map(quote).join(',')})`,
        );
        for (const row of rows) {
          if (row.game?.id) result.set(row.uid, better(result.get(row.uid), row.game));
        }
      }
      return result;
    },
  };
}
