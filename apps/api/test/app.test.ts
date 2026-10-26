import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AdultContentError, MissingConfigError, NotFoundError, UpstreamError } from '../src/lib/errors.js';
import type { GamesService } from '../src/services/gamesService.js';
import {
  stubDeals,
  stubGameDetails,
  stubGames,
  stubGiveaways,
  stubOffers,
  stubRecommendations,
  stubSearch,
} from './stubs.js';

function app(overrides: Partial<Parameters<typeof buildApp>[0]> = {}) {
  return buildApp({
    games: stubGames,
    gameDetails: stubGameDetails,
    giveaways: stubGiveaways,
    deals: stubDeals,
    offers: stubOffers,
    search: stubSearch,
    recommendations: stubRecommendations,
    ipSalt: 'sal-de-teste',
    corsOrigins: ['http://localhost:5173'],
    ...overrides,
  });
}

describe('API', () => {
  it('responde ao health check', async () => {
    const res = await (await app()).inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('valida offset, limit e adult', async () => {
    const server = await app();
    const bigLimit = await server.inject({ method: 'GET', url: '/api/games/new-popular?limit=999' });
    expect(bigLimit.statusCode).toBe(400);
    const badAdult = await server.inject({ method: 'GET', url: '/api/deals?adult=talvez' });
    expect(badAdult.statusCode).toBe(400);
    expect(badAdult.json().message).toContain('hide');
  });

  it('listas aceitam ordenação, com avaliações decrescente por padrão', async () => {
    const getDeals = vi.fn(stubDeals.getDeals);
    const server = await app({ deals: { ...stubDeals, getDeals } });
    await server.inject({ method: 'GET', url: '/api/deals' });
    await server.inject({ method: 'GET', url: '/api/deals?sort=release&order=asc' });
    expect(getDeals.mock.calls.map((c) => c.slice(3))).toEqual([
      ['reviews', 'desc'],
      ['release', 'asc'],
    ]);
    expect((await server.inject({ method: 'GET', url: '/api/deals?sort=preco' })).statusCode).toBe(400);
  });

  it('placar ao vivo: avisa as conexões abertas quando alguém vota', async () => {
    const server = await app();
    await server.listen({ port: 0, host: '127.0.0.1' });
    const { port } = server.server.address() as { port: number };
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/recommendations/events`, {
      signal: controller.signal,
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let received = decoder.decode((await reader.read()).value);
    expect(received).toContain(': conectado');

    await fetch(`http://127.0.0.1:${port}/api/recommendations/42/votes/up`, { method: 'PUT' });
    while (!received.includes('event: changed')) received += decoder.decode((await reader.read()).value);
    expect(received).toContain('"igdbId":42');

    controller.abort();
    await server.close();
  });

  it('oculta conteúdo adulto por padrão e repassa "show" quando pedido', async () => {
    const getNewPopular = vi.fn(stubGames.getNewPopular);
    const server = await app({ games: { getNewPopular } });
    await server.inject({ method: 'GET', url: '/api/games/new-popular' });
    await server.inject({ method: 'GET', url: '/api/games/new-popular?adult=show' });
    expect(getNewPopular.mock.calls.map((call) => call[2])).toEqual(['hide', 'show']);
  });

  it('valida a categoria de Novos populares e repassa para o serviço', async () => {
    const getNewPopular = vi.fn(stubGames.getNewPopular);
    const server = await app({ games: { getNewPopular } });
    expect((await server.inject({ method: 'GET', url: '/api/games/new-popular?category=x' })).statusCode).toBe(400);
    await server.inject({ method: 'GET', url: '/api/games/new-popular?category=demo' });
    expect(getNewPopular.mock.calls[0]?.[3]).toBe('demo');
  });

  it('página do jogo: valida o id e traduz 404 e 403', async () => {
    const getGame = vi.fn(async (id: number) => {
      if (id === 404) throw new NotFoundError('Jogo 404 não encontrado.');
      throw new AdultContentError();
    });
    const server = await app({ gameDetails: { getGame } });
    expect((await server.inject({ method: 'GET', url: '/api/games/abc' })).statusCode).toBe(400);
    expect((await server.inject({ method: 'GET', url: '/api/games/404' })).statusCode).toBe(404);
    const adult = await server.inject({ method: 'GET', url: '/api/games/7?adult=hide' });
    expect(adult.statusCode).toBe(403);
    expect(adult.json().error).toBe('adult_content');
    // A rota fixa continua tendo prioridade sobre /:id
    expect((await server.inject({ method: 'GET', url: '/api/games/new-popular' })).statusCode).toBe(200);
  });

  it('busca: converte listas e opções da URL e valida', async () => {
    const search = vi.fn(stubSearch.search);
    const server = await app({ search: { ...stubSearch, search } });
    const ok = await server.inject({
      method: 'GET',
      url: '/api/search?q=portal&players=4&mode=coop&unknownPlayers=1&prices=free,paid&stores=steam,epic&genres=5,12&yearMin=2020&ratingMin=80&sort=rating',
    });
    expect(ok.statusCode).toBe(200);
    expect(search.mock.calls[0]?.[0]).toEqual({
      q: 'portal',
      sort: 'rating',
      players: 4,
      mode: 'coop',
      unknownPlayers: true,
      showDuplicates: false,
      prices: ['free', 'paid'],
      stores: ['steam', 'epic'],
      genres: [5, 12],
      yearMin: 2020,
      yearMax: undefined,
      ratingMin: 80,
    });
    expect((await server.inject({ method: 'GET', url: '/api/search?players=1' })).statusCode).toBe(400);
    expect((await server.inject({ method: 'GET', url: '/api/search?stores=Steam!' })).statusCode).toBe(400);
    expect((await server.inject({ method: 'GET', url: '/api/search?prices=caro' })).statusCode).toBe(400);
    expect((await server.inject({ method: 'GET', url: '/api/search/suggest?q=po' })).statusCode).toBe(200);
    expect((await server.inject({ method: 'GET', url: '/api/search/facets' })).statusCode).toBe(200);
  });

  it('recomendações: identifica o votante pelo IP real (X-Forwarded-For) e valida o tipo de voto', async () => {
    const vote = vi.fn(stubRecommendations.vote);
    const server = await app({ recommendations: { ...stubRecommendations, vote } });
    const put = (ip: string) =>
      server.inject({ method: 'PUT', url: '/api/recommendations/7/votes/up', headers: { 'x-forwarded-for': ip } });

    expect((await put('200.1.1.1')).statusCode).toBe(200);
    await put('200.1.1.1');
    await put('200.2.2.2');
    const voters = vote.mock.calls.map((c) => c[1]);
    expect(voters[0]).toBe(voters[1]);
    expect(voters[0]).not.toBe(voters[2]);
    expect(voters[0]).not.toContain('200.1.1.1'); // só o hash é usado
    expect(vote.mock.calls[0]?.slice(2)).toEqual(['up', true]);

    const del = await server.inject({ method: 'DELETE', url: '/api/recommendations/7/votes/remove' });
    expect(del.statusCode).toBe(200);
    expect(vote.mock.calls.at(-1)?.slice(2)).toEqual(['remove', false]);
    expect((await server.inject({ method: 'PUT', url: '/api/recommendations/7/votes/talvez' })).statusCode).toBe(400);
  });

  it('recomendações: limita votos em sequência', async () => {
    const server = await app();
    let last = 0;
    for (let i = 0; i < 61; i++) {
      last = (await server.inject({ method: 'POST', url: '/api/recommendations/9', headers: { 'x-forwarded-for': '9.9.9.9' } }))
        .statusCode;
    }
    expect(last).toBe(429);
    // Outro IP não é afetado.
    expect((await server.inject({ method: 'POST', url: '/api/recommendations/9', headers: { 'x-forwarded-for': '8.8.8.8' } })).statusCode).toBe(200);
  });

  it('página de oferta: valida o ID da ITAD', async () => {
    const getOffer = vi.fn(async () => {
      throw new NotFoundError('Oferta não encontrada.');
    });
    const server = await app({ offers: { getOffer } });
    expect((await server.inject({ method: 'GET', url: '/api/offers/nao-e-uuid' })).statusCode).toBe(400);
    const res = await server.inject({ method: 'GET', url: '/api/offers/018d937f-07fc-72ed-8517-d8e24cb1eb22' });
    expect(res.statusCode).toBe(404);
    expect(getOffer).toHaveBeenCalledWith('018d937f-07fc-72ed-8517-d8e24cb1eb22', 'hide');
  });

  it('responde nas rotas de giveaways e ofertas', async () => {
    const server = await app();
    expect((await server.inject({ method: 'GET', url: '/api/giveaways' })).statusCode).toBe(200);
    expect((await server.inject({ method: 'GET', url: '/api/deals' })).statusCode).toBe(200);
  });

  it('devolve 502 com mensagem quando uma API externa falha', async () => {
    const failing: GamesService = {
      getNewPopular: async () => {
        throw new UpstreamError('igdb', 429, 'muitas requisições');
      },
    };
    const res = await (await app({ games: failing })).inject({ method: 'GET', url: '/api/games/new-popular' });
    expect(res.statusCode).toBe(502);
    expect(res.json().message).toContain('Limite de requisições atingido em IGDB');
  });

  it('devolve 503 quando falta configuração', async () => {
    const res = await (
      await app({
        deals: {
          getFreeDeals: async () => [],
          getDeals: async () => {
            throw new MissingConfigError('ITAD_API_KEY', 'A chave não está configurada.');
          },
        },
      })
    ).inject({ method: 'GET', url: '/api/deals' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'not_configured', message: 'A chave não está configurada.' });
  });

  it('libera CORS só para as origens configuradas', async () => {
    const server = await app();
    const allowed = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const blocked = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://outro-site.com' },
    });
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
