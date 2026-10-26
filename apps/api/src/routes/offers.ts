import type { FastifyInstance } from 'fastify';
import { parseOrThrow } from '../lib/validation.js';
import type { DealsService } from '../services/dealsService.js';
import type { GiveawaysService } from '../services/giveawaysService.js';
import type { OfferService } from '../services/offerService.js';
import { z } from 'zod';
import { listQuery, sortQuery } from './listQuery.js';

const sortedList = listQuery.merge(sortQuery);

const offerParams = z.object({ id: z.string().uuid('ID de oferta inválido') });

export function offersRoutes(giveaways: GiveawaysService, deals: DealsService, offers: OfferService) {
  return async (app: FastifyInstance) => {
    app.get('/api/giveaways', async (request, reply) => {
      const { offset, limit, adult, sort, order } = parseOrThrow(sortedList, request.query);
      const page = await giveaways.getGiveaways(offset, limit, adult, sort, order);
      reply.header('Cache-Control', 'public, max-age=300');
      return page;
    });

    app.get('/api/offers/:id', async (request, reply) => {
      const { id } = parseOrThrow(offerParams, request.params);
      const { adult } = parseOrThrow(listQuery.pick({ adult: true }), request.query);
      reply.header('Cache-Control', 'public, max-age=300');
      return offers.getOffer(id, adult);
    });

    app.get('/api/deals', async (request, reply) => {
      const { offset, limit, adult, sort, order } = parseOrThrow(sortedList, request.query);
      const page = await deals.getDeals(offset, limit, adult, sort, order);
      reply.header('Cache-Control', 'public, max-age=300');
      return page;
    });
  };
}
