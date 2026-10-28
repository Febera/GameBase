-- Cada dado da Steam com seu próprio prazo: preço muda muito; avaliações e detalhes, pouco.
-- fetched_at passa a ser a data dos detalhes (grátis, demo, conteúdo adulto).
ALTER TABLE steam_apps ADD COLUMN IF NOT EXISTS price_fetched_at TIMESTAMPTZ;
ALTER TABLE steam_apps ADD COLUMN IF NOT EXISTS reviews_fetched_at TIMESTAMPTZ;
UPDATE steam_apps SET price_fetched_at = fetched_at WHERE price_fetched_at IS NULL;
UPDATE steam_apps SET reviews_fetched_at = fetched_at WHERE reviews_fetched_at IS NULL;
