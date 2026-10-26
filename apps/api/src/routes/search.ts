import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseOrThrow } from '../lib/validation.js';
import type { SearchService } from '../services/searchService.js';
import { listQuery } from './listQuery.js';

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((v) => v.trim()).filter(Boolean) : []))
    .pipe(z.array(item));

const flag = z
  .enum(['1', '0', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

const year = z.coerce.number().int().min(1950, 'ano mínimo 1950').max(2100, 'ano máximo 2100').optional();

const searchQuery = listQuery.extend({
  q: z.string().trim().max(100, 'máximo 100 caracteres').optional(),
  sort: z.enum(['relevance', 'popular', 'rating', 'recent'], { message: 'ordenação inválida' }).optional(),
  players: z.coerce.number().int().min(2, 'mínimo 2').max(100, 'máximo 100').optional(),
  mode: z.enum(['online', 'coop'], { message: 'use "online" ou "coop"' }).optional(),
  unknownPlayers: flag,
  showDuplicates: flag,
  prices: csv(z.enum(['free', 'demo', 'paid'], { message: 'use free, demo ou paid' })),
  stores: csv(z.string().regex(/^[a-z]+$/, 'loja inválida')),
  genres: csv(z.coerce.number().int().positive()),
  yearMin: year,
  yearMax: year,
  ratingMin: z.coerce.number().int().min(0).max(100).optional(),
});

const suggestQuery = z.object({
  q: z.string().trim().max(100).default(''),
  adult: listQuery.shape.adult,
});

export function searchRoutes(search: SearchService) {
  return async (app: FastifyInstance) => {
    app.get('/api/search', async (request, reply) => {
      const { offset, limit, adult, ...filters } = parseOrThrow(searchQuery, request.query);
      const page = await search.search(filters, offset, limit, adult);
      reply.header('Cache-Control', page.pending ? 'no-store' : 'public, max-age=120');
      return page;
    });

    app.get('/api/search/suggest', async (request, reply) => {
      const { q, adult } = parseOrThrow(suggestQuery, request.query);
      reply.header('Cache-Control', 'public, max-age=300');
      return search.suggest(q, adult);
    });

    app.get('/api/search/facets', async (_request, reply) => {
      reply.header('Cache-Control', 'public, max-age=3600');
      return search.facets();
    });
  };
}
