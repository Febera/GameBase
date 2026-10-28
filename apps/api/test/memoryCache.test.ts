import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/memoryCache.js';
import { fakeClock } from './helpers.js';

describe('MemoryCache', () => {
  it('expira entradas depois do TTL', () => {
    const clock = fakeClock();
    const cache = new MemoryCache(10, clock.now);
    cache.set('a', 1, 1000);
    expect(cache.get('a')).toBe(1);
    clock.advance(1000);
    expect(cache.get('a')).toBeUndefined();
  });

  it('descarta a entrada menos usada quando passa do limite', () => {
    const cache = new MemoryCache(2);
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.get('a'); // "a" passa a ser a mais recente
    cache.set('c', 3, 60_000);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('compartilha a mesma carga entre chamadas simultâneas', async () => {
    const cache = new MemoryCache();
    const loader = vi.fn(async () => 'valor');
    const [x, y] = await Promise.all([
      cache.getOrSet('k', 1000, loader),
      cache.getOrSet('k', 1000, loader),
    ]);
    expect(x).toBe('valor');
    expect(y).toBe('valor');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('não guarda o resultado quando a carga falha', async () => {
    const cache = new MemoryCache();
    await expect(
      cache.getOrSet('k', 1000, async () => {
        throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');
    expect(await cache.getOrSet('k', 1000, async () => 'ok')).toBe('ok');
  });

  it('getOrSetStale serve o valor vencido na hora e recarrega em segundo plano', async () => {
    const clock = fakeClock();
    const cache = new MemoryCache(10, clock.now);
    let version = 0;
    const loader = vi.fn(async () => ++version);

    expect(await cache.getOrSetStale('k', 1000, loader)).toBe(1);
    clock.advance(1500); // venceu
    expect(await cache.getOrSetStale('k', 1000, loader)).toBe(1); // antigo, sem esperar
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(await cache.getOrSetStale('k', 1000, loader)).toBe(2);
  });

  it('servidor recém-acordado: serve a lista salva no banco e recarrega em segundo plano', async () => {
    const clock = fakeClock();
    const saved = new Map<string, { value: unknown; savedAt: Date }>([
      ['lista', { value: ['antiga'], savedAt: new Date(clock.now() - 60 * 60 * 1000) }],
    ]);
    const store = {
      load: vi.fn(async (key: string) => saved.get(key) ?? null),
      save: vi.fn(async (key: string, value: unknown, savedAt: Date) => void saved.set(key, { value, savedAt })),
    };
    const cache = new MemoryCache(500, clock.now);
    cache.attachStore(store);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const loader = vi.fn(async () => (await gate, ['nova']));

    expect(await cache.getOrSetStale('lista', 1000, loader)).toEqual(['antiga']); // na hora, do banco
    expect(loader).toHaveBeenCalledOnce(); // recarga já começou
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(await cache.getOrSetStale('lista', 1000, loader)).toEqual(['nova']);
    expect(saved.get('lista')?.value).toEqual(['nova']); // versão nova salva
    expect(store.load).toHaveBeenCalledOnce();
  });

  it('versão salva há mais de 24 h não é servida: espera a carga', async () => {
    const clock = fakeClock();
    const store = {
      load: async () => ({ value: ['velha'], savedAt: new Date(clock.now() - 25 * 60 * 60 * 1000) }),
      save: async () => {},
    };
    const cache = new MemoryCache(500, clock.now);
    cache.attachStore(store);
    expect(await cache.getOrSetStale('lista', 1000, async () => ['nova'])).toEqual(['nova']);
  });

  it('banco fora do ar não quebra o cache', async () => {
    const log = vi.fn();
    const cache = new MemoryCache();
    cache.attachStore(
      {
        load: async () => {
          throw new Error('sem conexão');
        },
        save: async () => {
          throw new Error('sem conexão');
        },
      },
      log,
    );
    expect(await cache.getOrSetStale('x', 1000, async () => 42)).toBe(42);
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toHaveBeenCalledTimes(2);
  });
});
