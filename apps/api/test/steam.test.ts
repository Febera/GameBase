import { describe, expect, it, vi } from 'vitest';
import { createSteamClient, parseAppDetails, parseReviews, REVIEW_PAUSE_MS } from '../src/clients/steam.js';
import type { SteamApp, SteamAppsRepository } from '../src/db/steamAppsRepository.js';
import { UpstreamError } from '../src/lib/errors.js';
import {
  createSteamSync,
  DETAILS_STALE_MS,
  jobsFor,
  MISSING_REVIEWS_RETRY_MS,
  PRICE_STALE_MS,
  REVIEWS_STALE_MS,
} from '../src/services/steamSync.js';
import type { SteamClient } from '../src/clients/steam.js';
import { fakeClock, jsonResponse } from './helpers.js';
import { steamApp } from './stubs.js';

const when = new Date('2026-10-23T12:00:00Z');

describe('parseAppDetails', () => {
  it('lê grátis, demo, preço e descritores de conteúdo', () => {
    const paid = parseAppDetails(
      1,
      {
        is_free: false,
        demos: [{ appid: 2 }],
        price_overview: { currency: 'BRL', initial: 5999, final: 1499, discount_percent: 75 },
        content_descriptors: { ids: [1, 2, 5] },
      },
      when,
    );
    expect(paid).toMatchObject({ found: true, isFree: false, hasDemo: true, adultContent: false });
    expect(paid.price).toEqual({ currency: 'BRL', initial: 5999, final: 1499, discountPercent: 75 });

    expect(parseAppDetails(1, { is_free: true, content_descriptors: { ids: [4] } }, when)).toMatchObject({
      isFree: true,
      hasDemo: false,
      adultContent: true,
      price: null,
    });
    expect(parseAppDetails(1, { content_descriptors: { ids: null } }, when).adultContent).toBe(false);
    expect(parseAppDetails(1, null, when)).toMatchObject({ found: false, isFree: null });
  });
});

describe('parseReviews', () => {
  it('calcula a % positiva e ignora jogos sem avaliações', () => {
    expect(parseReviews({ total_positive: 900, total_reviews: 1000 })).toEqual({ total: 1000, percent: 90 });
    expect(parseReviews({ total_positive: 0, total_reviews: 0 })).toBeNull();
    expect(parseReviews(null)).toBeNull();
  });
});

describe('createSteamClient', () => {
  it('junta detalhes da loja e avaliações em uma leitura', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('appreviews')
        ? jsonResponse({ success: 1, query_summary: { total_positive: 75, total_reviews: 100 } })
        : jsonResponse({ '7': { success: true, data: { is_free: false } } }),
    );
    const client = createSteamClient({ fetchFn: fetchFn as unknown as typeof fetch });
    const app = await client.appDetails(7);
    expect(app.reviews).toEqual({ total: 100, percent: 75 });
    expect((fetchFn.mock.calls[1] as unknown as [string])[0]).toContain('/appreviews/7?json=1');
  });

  it('pede preços do Brasil, sem filtros, e trata página inexistente', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ '42': { success: false } }));
    const client = createSteamClient({ fetchFn: fetchFn as unknown as typeof fetch, now: () => when.getTime() });
    const app = await client.appDetails(42);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toContain('appids=42');
    expect(url).toContain('cc=br');
    expect(url).not.toContain('filters');
    expect(app).toMatchObject({ appId: 42, found: false });
  });

  it('avaliações: pula variantes que voltam em HTML e memoriza a que funciona', async () => {
    const html = () => new Response('<!DOCTYPE html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    const reviewUrls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('/appdetails')) return jsonResponse({ [url.match(/appids=(\d+)/)![1]!]: { success: true, data: { is_free: false } } });
      reviewUrls.push(url);
      return url.includes('num_per_page=1') ? html() : jsonResponse({ success: 1, query_summary: { total_positive: 900, total_reviews: 1000 } });
    });
    const log = vi.fn();
    const client = createSteamClient({ fetchFn: fetchFn as unknown as typeof fetch, log });
    expect((await client.appDetails(1)).reviews).toEqual({ total: 1000, percent: 90 });
    expect(reviewUrls).toHaveLength(2); // 1ª variante em HTML, 2ª em JSON
    reviewUrls.length = 0;
    await client.appDetails(2);
    expect(reviewUrls).toHaveLength(1); // já começa pela que funcionou
    expect(reviewUrls[0]).toContain('cursor=*');
  });

  it('avaliações: sem nenhuma variante em JSON, desliga a consulta direta por 6 h', async () => {
    const clock = fakeClock();
    let reviewCalls = 0;
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('/appdetails')) return jsonResponse({ [url.match(/appids=(\d+)/)![1]!]: { success: true, data: { is_free: false } } });
      reviewCalls++;
      return new Response('<html></html>', { status: 200 });
    });
    const client = createSteamClient({ fetchFn: fetchFn as unknown as typeof fetch, now: clock.now });
    expect((await client.appDetails(1)).reviews).toBeNull();
    expect(reviewCalls).toBe(3);
    await client.appDetails(2);
    expect(reviewCalls).toBe(3); // pausada
    clock.advance(REVIEW_PAUSE_MS + 1);
    await client.appDetails(3);
    expect(reviewCalls).toBe(6);
  });

  it('preços em lote: uma consulta, "data: []" vira sem preço e quem falhou fica de fora', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        '10': { success: true, data: { price_overview: { currency: 'BRL', initial: 5999, final: 2999, discount_percent: 50 } } },
        '20': { success: true, data: [] },
        '30': { success: false },
      }),
    );
    const prices = await createSteamClient({ fetchFn: fetchFn as unknown as typeof fetch }).prices([10, 20, 30]);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toContain('appids=10,20,30');
    expect(url).toContain('filters=price_overview');
    expect([...prices]).toEqual([
      [10, { currency: 'BRL', initial: 5999, final: 2999, discountPercent: 50 }],
      [20, null],
    ]);
  });

  it('transforma erros HTTP em UpstreamError', async () => {
    const client = createSteamClient({ fetchFn: (async () => jsonResponse(null, 429)) as unknown as typeof fetch });
    const error = await client.appDetails(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(429);
  });
});

function memoryRepo(initial: SteamApp[] = []): SteamAppsRepository & { store: Map<number, SteamApp> } {
  const store = new Map(initial.map((a) => [a.appId, a]));
  return {
    store,
    async findMany(ids) {
      return new Map(ids.flatMap((id) => (store.has(id) ? [[id, store.get(id)!] as const] : [])));
    },
    async upsert(app) {
      store.set(app.appId, app);
    },
    async updatePrices(updates, at) {
      for (const u of updates) {
        const app = store.get(u.appId);
        if (app) store.set(u.appId, { ...app, price: u.price, priceFetchedAt: at });
      }
    },
    async updateReviews(appId, reviews, at) {
      const app = store.get(appId);
      if (app) store.set(appId, { ...app, reviews, reviewsFetchedAt: at });
    },
    async topRated() {
      return [];
    },
  };
}

/** Cliente falso que registra cada consulta: "d7" (detalhes), "p[1,2]" (preços em lote), "r7" (avaliações). */
function recordingClient(calls: string[], overrides: Partial<SteamClient> = {}): SteamClient {
  return {
    appDetails: async (id) => (calls.push(`d${id}`), steamApp(id)),
    prices: async (ids) => (
      calls.push(`p[${ids.join(',')}]`),
      new Map(ids.map((id) => [id, { currency: 'BRL', initial: 5000, final: 2500, discountPercent: 50 }]))
    ),
    reviews: async (id) => (calls.push(`r${id}`), { total: 800, percent: 88 }),
    ...overrides,
  };
}

describe('steamSync.jobsFor', () => {
  const nowMs = Date.UTC(2026, 9, 23, 12);
  const ago = (ms: number) => new Date(nowMs - ms - 1);

  it('jogo novo ou com detalhes vencidos: consulta completa', () => {
    expect(jobsFor(undefined, nowMs)).toEqual(['details']);
    expect(jobsFor(steamApp(1, { fetchedAt: ago(DETAILS_STALE_MS) }), nowMs)).toEqual(['details']);
  });

  it('preço vence em 12 h e avaliações em 7 dias, cada um por si', () => {
    const app = steamApp(1, { fetchedAt: ago(PRICE_STALE_MS), reviewsFetchedAt: new Date(nowMs) });
    expect(jobsFor(app, nowMs)).toEqual(['price']);
    expect(jobsFor({ ...app, reviewsFetchedAt: ago(REVIEWS_STALE_MS) }, nowMs)).toEqual(['price', 'reviews']);
    expect(jobsFor({ ...app, isFree: true }, nowMs)).toEqual([]); // grátis não tem preço
    expect(jobsFor(app, nowMs, { skipPrice: true })).toEqual([]);
    expect(jobsFor({ ...app, found: false }, nowMs)).toEqual([]);
  });

  it('com needReviews, quem está sem avaliações há mais de 1 h volta', () => {
    const fresh = { fetchedAt: new Date(nowMs), reviews: null };
    expect(jobsFor(steamApp(1, { ...fresh, reviewsFetchedAt: ago(MISSING_REVIEWS_RETRY_MS) }), nowMs, { needReviews: true })).toEqual(['reviews']);
    expect(jobsFor(steamApp(1, fresh), nowMs, { needReviews: true })).toEqual([]);
  });
});

describe('steamSync', () => {
  it('busca os que faltam primeiro, junta os preços vencidos num lote só e atualiza as avaliações', async () => {
    const clock = fakeClock();
    const now = new Date(clock.now());
    const old = new Date(clock.now() - PRICE_STALE_MS - 1);
    const repo = memoryRepo([
      steamApp(1, { fetchedAt: now }),
      steamApp(2, { fetchedAt: old }),
      steamApp(4, { fetchedAt: old }),
      steamApp(5, { fetchedAt: now, reviewsFetchedAt: new Date(clock.now() - REVIEWS_STALE_MS - 1) }),
    ]);
    const calls: string[] = [];
    const sync = createSteamSync({ steam: recordingClient(calls), repo, now: clock.now, sleep: async () => {} });

    await sync.refresh([1, 2, 3, 4, 5]);
    await sync.idle();
    expect(calls).toEqual(['d3', 'p[2,4]', 'r5']);
    expect(repo.store.get(2)?.price?.final).toBe(2500);
    expect(repo.store.get(2)?.priceFetchedAt?.getTime()).toBe(clock.now());
    expect(repo.store.get(5)?.reviews).toEqual({ total: 800, percent: 88 });

    const { pending } = await sync.read([1, 2, 3, 4, 9]);
    expect(pending).toBe(1);
  });

  it('lotes de preço respeitam o tamanho máximo', async () => {
    const clock = fakeClock();
    const old = new Date(clock.now() - PRICE_STALE_MS - 1);
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    const repo = memoryRepo(ids.map((id) => steamApp(id, { fetchedAt: old, reviewsFetchedAt: new Date(clock.now()) })));
    const calls: string[] = [];
    const sync = createSteamSync({ steam: recordingClient(calls), repo, now: clock.now, sleep: async () => {} });
    await sync.refresh(ids);
    await sync.idle();
    expect(calls.map((c) => c.split(',').length)).toEqual([50, 50, 20]);
  });

  it('com needReviews, rebusca só as avaliações de quem está sem elas há mais de 1 h', async () => {
    const clock = fakeClock();
    const now = new Date(clock.now());
    const hourAgo = new Date(clock.now() - MISSING_REVIEWS_RETRY_MS - 1);
    const repo = memoryRepo([
      steamApp(1, { fetchedAt: now, reviewsFetchedAt: hourAgo, reviews: null }), // volta
      steamApp(2, { fetchedAt: now, reviews: null }), // recente: espera
      steamApp(3, { fetchedAt: now, reviewsFetchedAt: hourAgo, reviews: { total: 900, percent: 90 } }), // completo
      steamApp(4, { fetchedAt: now, reviewsFetchedAt: hourAgo, found: false, reviews: null }), // fora da loja
    ]);
    const calls: string[] = [];
    const sync = createSteamSync({ steam: recordingClient(calls), repo, now: clock.now, sleep: async () => {} });
    await sync.refresh([1, 2, 3, 4]);
    await sync.idle();
    expect(calls).toEqual([]);
    await sync.refresh([1, 2, 3, 4], 'high', { needReviews: true });
    await sync.idle();
    expect(calls).toEqual(['r1']);
  });

  it('jogos de alta prioridade passam na frente da fila lenta', async () => {
    const calls: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const sync = createSteamSync({
      steam: recordingClient(calls, {
        appDetails: async (id) => {
          calls.push(`d${id}`);
          if (calls.length === 1) await gate;
          return steamApp(id);
        },
      }),
      repo: memoryRepo(),
      sleep: async () => {},
    });
    await sync.refresh([1, 2, 3], 'low');
    await sync.refresh([9, 3]); // 3 sobe para a fila rápida
    release();
    await sync.idle();
    expect(calls).toEqual(['d1', 'd9', 'd3', 'd2']);
  });

  it('não duplica jogos já na fila', async () => {
    const calls: string[] = [];
    const sync = createSteamSync({ steam: recordingClient(calls), repo: memoryRepo(), sleep: async () => {} });
    await Promise.all([sync.refresh([1, 2]), sync.refresh([2, 3])]);
    await sync.idle();
    expect(calls).toHaveLength(3);
  });

  it('pausa quando a Steam pede para desacelerar e depois continua, também nos lotes de preço', async () => {
    const clock = fakeClock();
    const old = new Date(clock.now() - PRICE_STALE_MS - 1);
    const sleeps: number[] = [];
    let failed = false;
    const calls: string[] = [];
    const log = vi.fn();
    const repo = memoryRepo([steamApp(8, { fetchedAt: old, reviewsFetchedAt: new Date(clock.now()) })]);
    const sync = createSteamSync({
      steam: recordingClient(calls, {
        prices: async (ids) => {
          if (!failed) {
            failed = true;
            throw new UpstreamError('steam', 429, 'devagar');
          }
          calls.push(`p[${ids.join(',')}]`);
          return new Map(ids.map((id) => [id, null]));
        },
      }),
      repo,
      now: clock.now,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      delayMs: 10,
      log,
    });
    await sync.refresh([7, 8]);
    await sync.idle();
    expect(calls).toEqual(['d7', 'p[8]']);
    expect(sleeps).toContain(2 * 60 * 1000);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('desacelerar'));
    expect(repo.store.get(8)?.price).toBeNull();
  });
});
