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
});
