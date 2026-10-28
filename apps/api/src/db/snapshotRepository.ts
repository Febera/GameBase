import type { Db } from './types.js';

/** Guarda e lê a última versão de uma lista em cache. */
export interface SnapshotStore {
  load(key: string): Promise<{ value: unknown; savedAt: Date } | null>;
  save(key: string, value: unknown, savedAt: Date): Promise<void>;
}

export function createSnapshotRepository(db: Db): SnapshotStore {
  return {
    async load(key) {
      const { rows } = await db.query<{ value: unknown; saved_at: Date | string }>(
        'SELECT value, saved_at FROM cache_snapshots WHERE key = $1',
        [key],
      );
      const row = rows[0];
      return row ? { value: row.value, savedAt: new Date(row.saved_at) } : null;
    },

    async save(key, value, savedAt) {
      await db.query(
        `INSERT INTO cache_snapshots (key, value, saved_at) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, saved_at = EXCLUDED.saved_at`,
        [key, JSON.stringify(value), savedAt],
      );
    },
  };
}
