-- Vínculo entre jogos da IGDB e App IDs da Steam, para não perguntar à IGDB toda vez.
-- steam_app_id nulo: a IGDB não conhece página da Steam para o jogo (verificado em checked_at).
CREATE TABLE IF NOT EXISTS igdb_steam (
  igdb_id      INTEGER PRIMARY KEY,
  steam_app_id INTEGER,
  checked_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS igdb_steam_app_idx ON igdb_steam (steam_app_id);
