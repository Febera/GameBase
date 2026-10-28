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
  /** Data dos detalhes (grátis, demo, conteúdo adulto); numa consulta completa, de tudo. */
  fetchedAt: Date;
  /** Data do preço, quando atualizado à parte (em lote). Ausente: vale fetchedAt. */
  priceFetchedAt?: Date | null;
  /** Data da última tentativa de buscar as avaliações. Ausente: vale fetchedAt. */
  reviewsFetchedAt?: Date | null;
}

/** Preço vindo da consulta em lote: o preço novo, ou null quando a Steam não informa preço. */
export interface SteamPriceUpdate {
  appId: number;
  price: SteamApp['price'];
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
  price_fetched_at?: Date | string | null;
  reviews_fetched_at?: Date | string | null;
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
    priceFetchedAt: row.price_fetched_at ? new Date(row.price_fetched_at) : null,
    reviewsFetchedAt: row.reviews_fetched_at ? new Date(row.reviews_fetched_at) : null,
  };
}

export interface SteamAppsRepository {
  findMany(appIds: number[]): Promise<Map<number, SteamApp>>;
  upsert(app: SteamApp): Promise<void>;
  /** Atualiza só o preço (consulta em lote) de jogos que já estão no banco. */
  updatePrices(updates: SteamPriceUpdate[], at: Date): Promise<void>;
  /** Atualiza só as avaliações (e a data da tentativa, mesmo sem avaliações). */
  updateReviews(appId: number, reviews: SteamApp['reviews'], at: Date): Promise<void>;
  /**
   * App IDs com pelo menos `minReviews` avaliações, pela média bayesiana (mesma fórmula de
   * bayesianRank, com m = minReviews e C = % média desses jogos), do melhor para o pior.
   */
  topRated(minReviews: number, limit: number): Promise<number[]>;
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
           price_currency, price_initial, price_final, discount_percent, review_total, review_percent, fetched_at,
           price_fetched_at, reviews_fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
           fetched_at = EXCLUDED.fetched_at,
           price_fetched_at = EXCLUDED.price_fetched_at,
           reviews_fetched_at = EXCLUDED.reviews_fetched_at`,
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
          app.priceFetchedAt ?? app.fetchedAt,
          app.reviewsFetchedAt ?? app.fetchedAt,
        ],
      );
    },

    async updatePrices(updates, at) {
      if (updates.length === 0) return;
      await db.query(
        `UPDATE steam_apps AS s SET
           price_currency = u.currency,
           price_initial = u.initial,
           price_final = u.final,
           discount_percent = u.discount,
           price_fetched_at = $6
         FROM unnest($1::int[], $2::text[], $3::int[], $4::int[], $5::int[])
           AS u(app_id, currency, initial, final, discount)
         WHERE s.app_id = u.app_id`,
        [
          updates.map((u) => u.appId),
          updates.map((u) => u.price?.currency ?? null),
          updates.map((u) => u.price?.initial ?? null),
          updates.map((u) => u.price?.final ?? null),
          updates.map((u) => u.price?.discountPercent ?? null),
          at,
        ],
      );
    },

    async topRated(minReviews, limit) {
      const { rows } = await db.query<{ app_id: number }>(
        `WITH e AS (
           SELECT app_id, review_total::float8 AS v, review_percent::float8 AS r
           FROM steam_apps WHERE found AND review_total >= $1
         ), c AS (SELECT avg(r) AS mean FROM e)
         SELECT app_id FROM e, c
         ORDER BY (v / (v + $1)) * r + ($1 / (v + $1)) * c.mean DESC, v DESC, app_id
         LIMIT $2`,
        [minReviews, limit],
      );
      return rows.map((row) => Number(row.app_id));
    },

    async updateReviews(appId, reviews, at) {
      await db.query(
        'UPDATE steam_apps SET review_total = $2, review_percent = $3, reviews_fetched_at = $4 WHERE app_id = $1',
        [appId, reviews?.total ?? null, reviews?.percent ?? null, at],
      );
    },
  };
}
