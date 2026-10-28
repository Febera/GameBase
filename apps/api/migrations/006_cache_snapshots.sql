-- Última versão das listas pesadas (ofertas, giveaways, novos populares), para servir na hora
-- quando o servidor acorda, em vez de reconstruir tudo com o visitante esperando.
CREATE TABLE IF NOT EXISTS cache_snapshots (
  key      TEXT PRIMARY KEY,
  value    JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL
);
