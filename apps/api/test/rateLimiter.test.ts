import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../src/clients/rateLimiter.js';

describe('createRateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('não deixa começar mais tarefas por segundo do que o limite', async () => {
    const limiter = createRateLimiter({ perSecond: 4, maxConcurrent: 8 });
    const startedAt: number[] = [];

    const all = Promise.all(
      Array.from({ length: 10 }, () =>
        limiter.run(async () => {
          startedAt.push(Date.now());
        }),
      ),
    );
    await vi.runAllTimersAsync();
    await all;

    expect(startedAt).toHaveLength(10);
    // Em qualquer janela de 1 segundo, no máximo 4 inícios.
    for (const t of startedAt) {
      const inWindow = startedAt.filter((s) => s >= t && s < t + 1000).length;
      expect(inWindow).toBeLessThanOrEqual(4);
    }
  });

  it('respeita o limite de tarefas simultâneas', async () => {
    const limiter = createRateLimiter({ perSecond: 100, maxConcurrent: 2 });
    let active = 0;
    let peak = 0;

    const all = Promise.all(
      Array.from({ length: 6 }, () =>
        limiter.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 50));
          active--;
        }),
      ),
    );
    await vi.runAllTimersAsync();
    await all;
    expect(peak).toBe(2);
  });
});
