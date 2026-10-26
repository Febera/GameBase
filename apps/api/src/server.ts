import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { MemoryCache } from './cache/memoryCache.js';
import { createGamerPowerClient } from './clients/gamerpower.js';
import { createIgdbClient } from './clients/igdb.js';
import { createItadClient } from './clients/itad.js';
import { createRateLimiter } from './clients/rateLimiter.js';
import { createSteamClient } from './clients/steam.js';
import { createTwitchAuth } from './clients/twitchAuth.js';
import { type Config, loadConfig } from './config.js';
import { migrate, readMigrations } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { createRecommendationsRepository, type RecommendationsRepository } from './db/recommendationsRepository.js';
import { createSteamAppsRepository } from './db/steamAppsRepository.js';
import { describeUrlMismatch } from './db/urls.js';
import { createAdultContentFilter } from './services/adultContent.js';
import { createDealsService } from './services/dealsService.js';
import { createGameDetailsService } from './services/gameDetailsService.js';
import { createGamesService } from './services/gamesService.js';
import { createGiveawaysService } from './services/giveawaysService.js';
import { createIgdbLookup } from './services/igdbLookup.js';
import { createItadPricing } from './services/itadPricing.js';
import { createOfferService } from './services/offerService.js';
import { createRecommendationsService } from './services/recommendationsService.js';
import { createSearchService } from './services/searchService.js';
import { createSteamSync, type SteamSync } from './services/steamSync.js';

/** Funciona tanto rodando de src/ (tsx) quanto de dist/ (build). */
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

type Log = (message: string) => void;

/**
 * Conecta ao banco, aplica as migrações e prepara a sincronização com a Steam.
 * Se algo falhar, o servidor sobe mesmo assim: só as divisões de "Novos populares" ficam indisponíveis.
 */
interface DbServices {
  steam: SteamSync;
  recommendations: RecommendationsRepository;
}

async function setupDatabase(config: Config, warn: Log, info: Log): Promise<DbServices | null> {
  if (!config.DATABASE_URL) {
    warn('DATABASE_URL não configurada: grátis, demos, pagos e recomendações vão responder 503.');
    return null;
  }
  const mismatch = describeUrlMismatch(config.DATABASE_URL, config.DATABASE_DIRECT_URL);
  if (mismatch) warn(mismatch);
  try {
    const migrationPool = createPool(config.DATABASE_DIRECT_URL ?? config.DATABASE_URL);
    try {
      const applied = await migrate(migrationPool, await readMigrations(MIGRATIONS_DIR));
      if (applied.length) info(`Migrações aplicadas: ${applied.join(', ')}`);
    } finally {
      await migrationPool.end();
    }
    const pool = createPool(config.DATABASE_URL);
    // Confere, pela conexão que as consultas vão usar, se as tabelas existem mesmo.
    const { rows } = await pool.query<{ table: string | null }>("SELECT to_regclass('public.steam_apps')::text AS table");
    if (!rows[0]?.table) {
      await pool.end();
      throw new Error(
        'as migrações rodaram, mas a tabela steam_apps não existe no banco de DATABASE_URL. ' +
          (mismatch ?? 'Confira se DATABASE_URL e DATABASE_DIRECT_URL são do mesmo branch e banco.'),
      );
    }
    return {
      steam: createSteamSync({
        steam: createSteamClient(),
        repo: createSteamAppsRepository(pool),
        log: warn,
      }),
      recommendations: createRecommendationsRepository(pool),
    };
  } catch (error) {
    warn(`Banco indisponível: ${(error as Error).message} Grátis, demos, pagos e recomendações vão responder 503.`);
    return null;
  }
}

async function main() {
  const config = loadConfig();
  // Logs antes do Fastify existir vão para o console; depois, para o logger dele.
  let warn: Log = (message) => console.warn(message);
  let info: Log = (message) => console.info(message);

  const auth = createTwitchAuth({
    clientId: config.TWITCH_CLIENT_ID,
    clientSecret: config.TWITCH_CLIENT_SECRET,
  });
  const igdb = createIgdbClient({
    clientId: config.TWITCH_CLIENT_ID,
    auth,
    limiter: createRateLimiter({ perSecond: 4, maxConcurrent: 8 }),
  });
  const itad = createItadClient({ apiKey: config.ITAD_API_KEY });
  const gamerpower = createGamerPowerClient();

  const cache = new MemoryCache();
  const adult = createAdultContentFilter({ igdb, cache });
  const lookup = createIgdbLookup(igdb);
  const database = await setupDatabase(config, (m) => warn(m), (m) => info(m));
  const steam = database?.steam ?? null;
  const deals = createDealsService({ itad, lookup, adult, cache, steam, log: (m) => warn(m) });
  const giveaways = createGiveawaysService({ gamerpower, deals, lookup, adult, itad, cache, steam, log: (m) => warn(m) });
  const pricing = createItadPricing({ itad, cache, log: (m) => warn(m) });
  const games = createGamesService({ igdb, cache, adult, lookup, steam, log: (m) => warn(m) });

  const app = await buildApp({
    games,
    gameDetails: createGameDetailsService({
      igdb,
      lookup,
      adult,
      itad,
      steam,
      cache,
      pricing,
      giveaways,
      log: (m) => warn(m),
    }),
    giveaways,
    deals,
    offers: createOfferService({ pricing, lookup, adult, giveaways }),
    search: createSearchService({ igdb, cache, adult, lookup, steam, itad, log: (m) => warn(m) }),
    recommendations: createRecommendationsService({
      repo: database?.recommendations ?? null,
      igdb,
      adult,
      lookup,
      steam,
      cache,
    }),
    ipSalt: config.IP_HASH_SALT ?? 'partida-sal-padrao',
    corsOrigins: config.corsOrigins,
    logger: { level: config.LOG_LEVEL },
  });
  warn = (message) => app.log.warn(message);
  info = (message) => app.log.info(message);

  if (!config.IP_HASH_SALT) {
    warn('IP_HASH_SALT não configurado: usando um valor padrão. Defina um segredo próprio em produção.');
  }
  if (!itad.configured) {
    warn('ITAD_API_KEY não configurada: "Grandes ofertas" vai responder 503 até ela ser definida.');
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Recebido ${signal}, encerrando.`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });

  // Aquece as listas pesadas em segundo plano: a primeira visita não espera montá-las.
  if (itad.configured) {
    void deals.getDeals(0, 1, 'hide').catch((e: unknown) => warn(`Aquecimento de ofertas falhou: ${String(e)}`));
  }
  void games.getNewPopular(0, 1, 'hide').catch((e: unknown) => warn(`Aquecimento de novos populares falhou: ${String(e)}`));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
