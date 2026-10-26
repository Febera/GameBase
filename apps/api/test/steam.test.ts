import { describe, expect, it, vi } from 'vitest';
import { createSteamClient, parseAppDetails, parseReviews } from '../src/clients/steam.js';
import type { SteamApp, SteamAppsRepository } from '../src/db/steamAppsRepository.js';
import { UpstreamError } from '../src/lib/errors.js';
import { createSteamSync, STEAM_STALE_MS } from '../src/services/steamSync.js';
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
  };
}

describe('steamSync', () => {
  it('busca os que faltam antes dos desatualizados e ignora os recentes', async () => {
    const clock = fakeClock();
    const now = new Date(clock.now());
    const old = new Date(clock.now() - STEAM_STALE_MS - 1);
    const repo = memoryRepo([steamApp(1, { fetchedAt: now }), steamApp(2, { fetchedAt: old })]);
    const order: number[] = [];
    const sync = createSteamSync({
      steam: { appDetails: async (id) => (order.push(id), steamApp(id, { fetchedAt: now })) },
      repo,
      now: clock.now,
      sleep: async () => {},
    });

    await sync.refresh([1, 2, 3]);
    await sync.idle();
    expect(order).toEqual([3, 2]);
    expect(repo.store.size).toBe(3);

    const { pending } = await sync.read([1, 2, 3, 4]);
    expect(pending).toBe(1);
  });

  it('jogos de alta prioridade passam na frente da fila lenta', async () => {
    const order: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const sync = createSteamSync({
      steam: {
        appDetails: async (id) => {
          order.push(id);
          if (order.length === 1) await gate;
          return steamApp(id);
        },
      },
      repo: memoryRepo(),
      sleep: async () => {},
    });
    await sync.refresh([1, 2, 3], 'low');
    await sync.refresh([9, 3]); // 3 sobe para a fila rápida
    release();
    await sync.idle();
    expect(order).toEqual([1, 9, 3, 2]);
  });

  it('não duplica jogos já na fila', async () => {
    let calls = 0;
    const sync = createSteamSync({
      steam: { appDetails: async (id) => (calls++, steamApp(id)) },
      repo: memoryRepo(),
      sleep: async () => {},
    });
    await Promise.all([sync.refresh([1, 2]), sync.refresh([2, 3])]);
    await sync.idle();
    expect(calls).toBe(3);
  });

  it('pausa quando a Steam pede para desacelerar e depois continua', async () => {
    const sleeps: number[] = [];
    let first = true;
    const log = vi.fn();
    const sync = createSteamSync({
      steam: {
        appDetails: async (id) => {
          if (first) {
            first = false;
            throw new UpstreamError('steam', 429, 'devagar');
          }
          return steamApp(id);
        },
      },
      repo: memoryRepo(),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      delayMs: 10,
      log,
    });
    await sync.refresh([7]);
    await sync.idle();
    expect(sleeps[0]).toBeGreaterThan(60_000);
    expect(sync.queued).toBe(0);
    expect(log).toHaveBeenCalledOnce();
  });
});
