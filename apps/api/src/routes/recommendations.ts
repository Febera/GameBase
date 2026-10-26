import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { TooManyRequestsError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validation.js';
import { voterId } from '../lib/voter.js';
import type { RecommendationsService } from '../services/recommendationsService.js';
import { listQuery } from './listQuery.js';

const idParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'deve ser um número' }).int().positive('inválido'),
});
const voteParams = idParams.extend({
  kind: z.enum(['up', 'remove'], { message: 'use "up" ou "remove"' }),
});

/** Limite simples de escrita por votante, contra cliques em sequência ou scripts. */
const WRITE_LIMIT = 60;
const WRITE_WINDOW_MS = 10 * 60 * 1000;

/** Intervalo do "ping" que mantém a conexão ao vivo aberta em proxies. */
const PING_MS = 25_000;

export function recommendationsRoutes(
  service: RecommendationsService,
  salt: string,
  corsOrigins: string[],
  now = () => Date.now(),
) {
  const writes = new Map<string, number[]>();
  /** Conexões abertas do placar ao vivo (Server-Sent Events). */
  const listeners = new Set<NodeJS.WritableStream>();

  /** Avisa todo mundo conectado que o placar mudou; cada navegador recarrega o que precisa. */
  function broadcast(igdbId: number) {
    const message = `event: changed\ndata: ${JSON.stringify({ igdbId })}\n\n`;
    for (const stream of listeners) stream.write(message);
  }

  const voterOf = (request: FastifyRequest) => voterId(request.ip, salt);

  function checkWriteLimit(voter: string) {
    const t = now();
    const recent = (writes.get(voter) ?? []).filter((at) => t - at < WRITE_WINDOW_MS);
    if (recent.length >= WRITE_LIMIT) {
      throw new TooManyRequestsError('Muitos votos em pouco tempo. Espere alguns minutos e tente de novo.');
    }
    recent.push(t);
    writes.set(voter, recent);
  }

  return async (app: FastifyInstance) => {
    app.get('/api/recommendations/events', (request, reply) => {
      const origin = request.headers.origin;
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        // Desliga o buffer de proxies (Render/nginx), para cada evento chegar na hora.
        'X-Accel-Buffering': 'no',
        ...(origin && corsOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
      });
      res.write(': conectado\n\n');
      listeners.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
      request.raw.on('close', () => {
        clearInterval(ping);
        listeners.delete(res);
      });
    });

    app.addHook('onClose', async () => {
      for (const stream of listeners) stream.end();
      listeners.clear();
    });

    app.get('/api/recommendations', async (request, reply) => {
      const { adult } = parseOrThrow(listQuery.pick({ adult: true }), request.query);
      reply.header('Cache-Control', 'no-store');
      return service.board(voterOf(request), adult);
    });

    app.get('/api/recommendations/:id', async (request, reply) => {
      const { id } = parseOrThrow(idParams, request.params);
      reply.header('Cache-Control', 'no-store');
      return service.status(id, voterOf(request));
    });

    app.post('/api/recommendations/:id', async (request) => {
      const { id } = parseOrThrow(idParams, request.params);
      const voter = voterOf(request);
      checkWriteLimit(voter);
      const result = await service.recommend(id, voter);
      broadcast(id);
      return result;
    });

    app.put('/api/recommendations/:id/votes/:kind', async (request) => {
      const { id, kind } = parseOrThrow(voteParams, request.params);
      const voter = voterOf(request);
      checkWriteLimit(voter);
      const result = await service.vote(id, voter, kind, true);
      broadcast(id);
      return result;
    });

    app.delete('/api/recommendations/:id/votes/:kind', async (request) => {
      const { id, kind } = parseOrThrow(voteParams, request.params);
      const voter = voterOf(request);
      checkWriteLimit(voter);
      const result = await service.vote(id, voter, kind, false);
      broadcast(id);
      return result;
    });
  };
}
