-- Avaliações dos jogadores na Steam: total e porcentagem de positivas.
ALTER TABLE steam_apps ADD COLUMN IF NOT EXISTS review_total INTEGER;
ALTER TABLE steam_apps ADD COLUMN IF NOT EXISTS review_percent INTEGER;
