-- Dados da loja Steam de cada jogo, guardados para não consultar a Steam a cada visita.
CREATE TABLE IF NOT EXISTS steam_apps (
  app_id           INTEGER PRIMARY KEY,
  -- false quando a Steam não tem a página (removida, bloqueada na região etc.)
  found            BOOLEAN NOT NULL,
  is_free          BOOLEAN,
  has_demo         BOOLEAN,
  -- descritores 3 ou 4 da Steam: conteúdo sexual explícito ou como foco
  adult_content    BOOLEAN NOT NULL DEFAULT FALSE,
  price_currency   TEXT,
  -- valores em centavos, como a Steam informa
  price_initial    INTEGER,
  price_final      INTEGER,
  discount_percent INTEGER,
  fetched_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS steam_apps_fetched_at_idx ON steam_apps (fetched_at);
