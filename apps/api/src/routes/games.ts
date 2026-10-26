import type { FastifyInstance } from 'fastify';
import { parseOrThrow } from '../lib/validation.js';
import type { GameDetailsService } from '../services/gameDetailsService.js';
import type { GamesService } from '../services/gamesService.js';
import { z } from 'zod';
import { listQuery, sortQuery } from './listQuery.js';

const newPopularQuery = listQuery.merge(sortQuery).extend({
  category: z.enum(['free', 'demo', 'paid'], { message: 'use "free", "demo" ou "paid"' }).optional(),
});

const gameParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'deve ser um número' }).int('deve ser inteiro').positive('inválido'),
});
const gameQuery = listQuery.pick({ adult: true });

export function gamesRoutes(games: GamesService, details: GameDetailsService) {
  return async (app: FastifyInstance) => {
    app.get('/api/games/:id', async (request, reply) => {
      const { id } = parseOrThrow(gameParams, request.params);
      const { adult } = parseOrThrow(gameQuery, request.query);
      const game = await details.getGame(id, adult);
      reply.header('Cache-Control', 'public, max-age=300');
      return game;
    });

    app.get('/api/games/new-popular', async (request, reply) => {
      const { offset, limit, adult, category, sort, order } = parseOrThrow(newPopularQuery, request.query);
      const page = await games.getNewPopular(offset, limit, adult, category, sort, order);
      // Lista que ainda está sendo preenchida não deve ficar em cache no navegador.
      reply.header('Cache-Control', page.pending ? 'no-store' : 'public, max-age=300');
      return page;
    });
  };
}
