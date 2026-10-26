-- Placar de recomendações do grupo.
CREATE TABLE IF NOT EXISTS recommendations (
  igdb_id        INTEGER PRIMARY KEY,
  -- cópia do nome e da capa, para o placar não depender da IGDB a cada visita
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  cover_image_id TEXT,
  -- hash do IP de quem recomendou (o IP em si nunca é guardado)
  recommended_by TEXT NOT NULL,
  recommended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votos: 'up' (apoio) e 'remove' (pedido de remoção). Um de cada tipo por IP e jogo.
CREATE TABLE IF NOT EXISTS recommendation_votes (
  igdb_id    INTEGER NOT NULL REFERENCES recommendations (igdb_id) ON DELETE CASCADE,
  voter      TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('up', 'remove')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (igdb_id, voter, kind)
);

CREATE INDEX IF NOT EXISTS recommendation_votes_kind_idx ON recommendation_votes (igdb_id, kind);
