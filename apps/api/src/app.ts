import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  AdultContentError,
  BadRequestError,
  MissingConfigError,
  NotFoundError,
  TooManyRequestsError,
  UpstreamError,
} from './lib/errors.js';
import { gamesRoutes } from './routes/games.js';
import { healthRoutes } from './routes/health.js';
import { offersRoutes } from './routes/offers.js';
import { recommendationsRoutes } from './routes/recommendations.js';
import { searchRoutes } from './routes/search.js';
import type { DealsService } from './services/dealsService.js';
import type { GameDetailsService } from './services/gameDetailsService.js';
import type { GamesService } from './services/gamesService.js';
import type { GiveawaysService } from './services/giveawaysService.js';
import type { OfferService } from './services/offerService.js';
import type { RecommendationsService } from './services/recommendationsService.js';
import type { SearchService } from './services/searchService.js';

export interface AppDeps {
  games: GamesService;
  gameDetails: GameDetailsService;
  giveaways: GiveawaysService;
  deals: DealsService;
  offers: OfferService;
  search: SearchService;
  recommendations: RecommendationsService;
  /** Segredo usado no hash do IP dos votantes. */
  ipSalt: string;
  corsOrigins: string[];
  logger?: FastifyServerOptions['logger'];
}

const SOURCE_NAMES: Record<string, string> = {
  igdb: 'IGDB',
  twitch: 'Twitch',
  itad: 'IsThereAnyDeal',
  gamerpower: 'GamerPower',
};

/** Monta a aplicação sem abrir porta, o que permite testar com app.inject(). */
export async function buildApp({
  games,
  gameDetails,
  giveaways,
  deals,
  offers,
  search,
  recommendations,
  ipSalt,
  corsOrigins,
  logger = false,
}: AppDeps) {
  const app = Fastify({
    logger,
    // Atrás do proxy do Render, o IP real do visitante vem em X-Forwarded-For.
    // Essencial para a regra de um voto por IP (etapa 6).
    trustProxy: true,
  });

  await app.register(cors, { origin: corsOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'] });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof BadRequestError) {
      return reply.status(400).send({ error: 'bad_request', message: error.message });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ error: 'not_found', message: error.message });
    }
    if (error instanceof TooManyRequestsError) {
      return reply.status(429).send({ error: 'too_many_requests', message: error.message });
    }
    if (error instanceof AdultContentError) {
      return reply.status(403).send({ error: 'adult_content', message: error.message });
    }
    if (error instanceof MissingConfigError) {
      return reply.status(503).send({ error: 'not_configured', message: error.message });
    }
    if (error instanceof UpstreamError) {
      request.log.warn({ source: error.source, status: error.status }, error.message);
      const message =
        error.status === 429
          ? `Limite de requisições atingido em ${SOURCE_NAMES[error.source] ?? error.source}. Tente de novo em alguns segundos.`
          : error.message;
      return reply.status(502).send({ error: 'upstream_error', message });
    }
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: 'internal_error', message: 'Erro inesperado no servidor. Veja os logs da API.' });
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send({ error: 'not_found', message: `Rota não encontrada: ${request.method} ${request.url}` }),
  );

  await app.register(healthRoutes);
  await app.register(gamesRoutes(games, gameDetails));
  await app.register(offersRoutes(giveaways, deals, offers));
  await app.register(searchRoutes(search));
  await app.register(recommendationsRoutes(recommendations, ipSalt, corsOrigins));

  return app;
}
