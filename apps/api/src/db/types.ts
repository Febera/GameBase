/**
 * O mínimo de um cliente Postgres que o código usa.
 * O Pool e o Client do pacote "pg" atendem a esta interface.
 */
export interface Db {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

/** Pool que empresta uma conexão exclusiva, necessária para transações. */
export interface DbPool extends Db {
  connect(): Promise<Db & { release(): void }>;
}
