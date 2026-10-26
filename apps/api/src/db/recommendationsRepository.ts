import type { Db, DbPool } from './types.js';

/** Pedidos de remoção que tiram um jogo do placar. */
export const REMOVE_THRESHOLD = 5;

export interface RecommendationRow {
  igdbId: number;
  name: string;
  slug: string;
  coverImageId: string | null;
  recommendedAt: Date;
  upvotes: number;
  removeVotes: number;
  votedUp: boolean;
  votedRemove: boolean;
}

export interface NewRecommendation {
  igdbId: number;
  name: string;
  slug: string;
  coverImageId: string | null;
}

export type VoteOutcome = 'ok' | 'removed' | 'not_found';

export interface RecommendationsRepository {
  list(voter: string): Promise<RecommendationRow[]>;
  get(igdbId: number, voter: string): Promise<RecommendationRow | null>;
  /** Cria (se ainda não existe) e registra o apoio de quem recomendou. */
  recommend(game: NewRecommendation, voter: string): Promise<void>;
  /** Liga ou desliga um voto. Ao atingir o limite de remoção, o jogo sai do placar. */
  setVote(igdbId: number, voter: string, kind: 'up' | 'remove', on: boolean): Promise<VoteOutcome>;
}

const SELECT = `
  SELECT r.igdb_id, r.name, r.slug, r.cover_image_id, r.recommended_at,
         COUNT(v.voter) FILTER (WHERE v.kind = 'up')      AS upvotes,
         COUNT(v.voter) FILTER (WHERE v.kind = 'remove')  AS remove_votes,
         COALESCE(BOOL_OR(v.kind = 'up' AND v.voter = $1), FALSE)     AS voted_up,
         COALESCE(BOOL_OR(v.kind = 'remove' AND v.voter = $1), FALSE) AS voted_remove
    FROM recommendations r
    LEFT JOIN recommendation_votes v ON v.igdb_id = r.igdb_id`;

interface Row {
  igdb_id: number;
  name: string;
  slug: string;
  cover_image_id: string | null;
  recommended_at: Date | string;
  upvotes: string | number;
  remove_votes: string | number;
  voted_up: boolean;
  voted_remove: boolean;
}

function fromRow(row: Row): RecommendationRow {
  return {
    igdbId: Number(row.igdb_id),
    name: row.name,
    slug: row.slug,
    coverImageId: row.cover_image_id,
    recommendedAt: new Date(row.recommended_at),
    upvotes: Number(row.upvotes),
    removeVotes: Number(row.remove_votes),
    votedUp: row.voted_up,
    votedRemove: row.voted_remove,
  };
}

/** Executa `work` numa transação, com uma conexão exclusiva. */
async function transaction<T>(pool: DbPool, work: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createRecommendationsRepository(pool: DbPool): RecommendationsRepository {
  return {
    async list(voter) {
      const { rows } = await pool.query<Row>(
        `${SELECT} GROUP BY r.igdb_id ORDER BY upvotes DESC, r.recommended_at ASC, r.igdb_id ASC`,
        [voter],
      );
      return rows.map(fromRow);
    },

    async get(igdbId, voter) {
      const { rows } = await pool.query<Row>(`${SELECT} WHERE r.igdb_id = $2 GROUP BY r.igdb_id`, [voter, igdbId]);
      return rows[0] ? fromRow(rows[0]) : null;
    },

    async recommend(game, voter) {
      await transaction(pool, async (db) => {
        await db.query(
          `INSERT INTO recommendations (igdb_id, name, slug, cover_image_id, recommended_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (igdb_id) DO NOTHING`,
          [game.igdbId, game.name, game.slug, game.coverImageId, voter],
        );
        await db.query(
          `INSERT INTO recommendation_votes (igdb_id, voter, kind) VALUES ($1, $2, 'up')
           ON CONFLICT DO NOTHING`,
          [game.igdbId, voter],
        );
      });
    },

    async setVote(igdbId, voter, kind, on) {
      return transaction(pool, async (db) => {
        // Trava a linha: dois pedidos de remoção simultâneos não passam do limite sem perceber.
        const exists = await db.query('SELECT 1 FROM recommendations WHERE igdb_id = $1 FOR UPDATE', [igdbId]);
        if (exists.rows.length === 0) return 'not_found';

        if (on) {
          await db.query(
            'INSERT INTO recommendation_votes (igdb_id, voter, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [igdbId, voter, kind],
          );
        } else {
          await db.query('DELETE FROM recommendation_votes WHERE igdb_id = $1 AND voter = $2 AND kind = $3', [
            igdbId,
            voter,
            kind,
          ]);
        }

        if (kind === 'remove' && on) {
          const { rows } = await db.query<{ n: string }>(
            "SELECT COUNT(*) AS n FROM recommendation_votes WHERE igdb_id = $1 AND kind = 'remove'",
            [igdbId],
          );
          if (Number(rows[0]?.n ?? 0) >= REMOVE_THRESHOLD) {
            // Sai do placar com todos os votos; se for recomendado de novo, começa do zero.
            await db.query('DELETE FROM recommendations WHERE igdb_id = $1', [igdbId]);
            return 'removed';
          }
        }
        return 'ok';
      });
    },
  };
}
