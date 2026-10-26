import type { Db } from './types.js';

/** Dados da Steam de um jogo, como guardados no banco. */
export interface SteamApp {
  appId: number;
  found: boolean;
  isFree: boolean | null;
  hasDemo: boolean | null;
  adultContent: boolean;
  price: {
    currency: string;
    /** Centavos */
    initial: number;
    final: number;
    discountPercent: number;
  } | null;
  /** Avaliações dos jogadores (total e % positivas), quando a Steam informa. */
  reviews: { total: number; percent: number } | null;
  fetchedAt: Date;
}

interface Row {
  app_id: number;
  found: boolean;
  is_free: boolean | null;
  has_demo: boolean | null;
  adult_content: boolean;
  price_currency: string | null;
  price_initial: number | null;
  price_final: number | null;
  discount_percent: number | null;
  review_total: number | null;
  review_percent: number | null;
  fetched_at: Date | string;
}

function fromRow(row: Row): SteamApp {
  return {
    appId: Number(row.app_id),
    found: row.found,
    isFree: row.is_free,
    hasDemo: row.has_demo,
    adultContent: row.adult_content,
    price:
      row.price_currency !== null && row.price_initial !== null && row.price_final !== null
        ? {
            currency: row.price_currency,
            initial: Number(row.price_initial),
            final: Number(row.price_final),
            discountPercent: Number(row.discount_percent ?? 0),
          }
        : null,
    reviews:
      row.review_total !== null && row.review_percent !== null
        ? { total: Number(row.review_total), percent: Number(row.review_percent) }
        : null,
    fetchedAt: new Date(row.fetched_at),
  };
}

export interface SteamAppsRepository {
  findMany(appIds: number[]): Promise<Map<number, SteamApp>>;
  upsert(app: SteamApp): Promise<void>;
}

export function createSteamAppsRepository(db: Db): SteamAppsRepository {
  return {
    async findMany(appIds) {
      const result = new Map<number, SteamApp>();
      if (appIds.length === 0) return result;
      const { rows } = await db.query<Row>('SELECT * FROM steam_apps WHERE app_id = ANY($1::int[])', [
        appIds,
      ]);
      for (const row of rows) {
        const app = fromRow(row);
        result.set(app.appId, app);
      }
      return result;
    },

    async upsert(app) {
      await db.query(
        `INSERT INTO steam_apps (app_id, found, is_free, has_demo, adult_content,
           price_currency, price_initial, price_final, discount_percent, review_total, review_percent, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (app_id) DO UPDATE SET
           found = EXCLUDED.found,
           is_free = EXCLUDED.is_free,
           has_demo = EXCLUDED.has_demo,
           adult_content = EXCLUDED.adult_content,
           price_currency = EXCLUDED.price_currency,
           price_initial = EXCLUDED.price_initial,
           price_final = EXCLUDED.price_final,
           discount_percent = EXCLUDED.discount_percent,
           review_total = EXCLUDED.review_total,
           review_percent = EXCLUDED.review_percent,
           fetched_at = EXCLUDED.fetched_at`,
        [
          app.appId,
          app.found,
          app.isFree,
          app.hasDemo,
          app.adultContent,
          app.price?.currency ?? null,
          app.price?.initial ?? null,
          app.price?.final ?? null,
          app.price?.discountPercent ?? null,
          app.reviews?.total ?? null,
          app.reviews?.percent ?? null,
          app.fetchedAt,
        ],
      );
    },
  };
}
