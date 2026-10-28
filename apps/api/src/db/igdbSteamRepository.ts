import type { Db } from './types.js';

export interface IgdbSteamLink {
  igdbId: number;
  /** null: a IGDB não tem página da Steam para o jogo. */
  steamAppId: number | null;
  checkedAt: Date;
}

export interface IgdbSteamRepository {
  findByIgdb(igdbIds: number[]): Promise<Map<number, IgdbSteamLink>>;
  /** Jogo da IGDB de cada App ID da Steam (o primeiro, quando há mais de um). */
  findBySteam(appIds: number[]): Promise<Map<number, number>>;
  upsertMany(links: IgdbSteamLink[]): Promise<void>;
}

export function createIgdbSteamRepository(db: Db): IgdbSteamRepository {
  return {
    async findByIgdb(igdbIds) {
      const result = new Map<number, IgdbSteamLink>();
      if (igdbIds.length === 0) return result;
      const { rows } = await db.query<{ igdb_id: number; steam_app_id: number | null; checked_at: Date | string }>(
        'SELECT igdb_id, steam_app_id, checked_at FROM igdb_steam WHERE igdb_id = ANY($1::int[])',
        [igdbIds],
      );
      for (const row of rows) {
        result.set(Number(row.igdb_id), {
          igdbId: Number(row.igdb_id),
          steamAppId: row.steam_app_id === null ? null : Number(row.steam_app_id),
          checkedAt: new Date(row.checked_at),
        });
      }
      return result;
    },

    async findBySteam(appIds) {
      const result = new Map<number, number>();
      if (appIds.length === 0) return result;
      const { rows } = await db.query<{ igdb_id: number; steam_app_id: number }>(
        'SELECT igdb_id, steam_app_id FROM igdb_steam WHERE steam_app_id = ANY($1::int[]) ORDER BY igdb_id',
        [appIds],
      );
      for (const row of rows) {
        const appId = Number(row.steam_app_id);
        if (!result.has(appId)) result.set(appId, Number(row.igdb_id));
      }
      return result;
    },

    async upsertMany(links) {
      if (links.length === 0) return;
      // Um INSERT por lote, com arrays (unnest), em vez de uma consulta por jogo.
      await db.query(
        `INSERT INTO igdb_steam (igdb_id, steam_app_id, checked_at)
         SELECT * FROM unnest($1::int[], $2::int[], $3::timestamptz[])
         ON CONFLICT (igdb_id) DO UPDATE SET
           steam_app_id = EXCLUDED.steam_app_id,
           checked_at = EXCLUDED.checked_at`,
        [links.map((l) => l.igdbId), links.map((l) => l.steamAppId), links.map((l) => l.checkedAt)],
      );
    },
  };
}
