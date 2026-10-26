import { type Clock, type Sleep, realSleep, systemClock } from '../lib/time.js';

export interface RateLimiter {
  run<T>(task: () => Promise<T>): Promise<T>;
}

interface Options {
  perSecond: number;
  maxConcurrent: number;
  now?: Clock;
  sleep?: Sleep;
}

/**
 * Limita quantas requisições começam por segundo e quantas ficam abertas ao mesmo tempo.
 * A IGDB documenta 4 req/s e até 8 simultâneas; acima disso responde 429.
 */
export function createRateLimiter({
  perSecond,
  maxConcurrent,
  now = systemClock,
  sleep = realSleep,
}: Options): RateLimiter {
  const starts: number[] = [];
  let active = 0;

  async function acquire(): Promise<void> {
    for (;;) {
      const t = now();
      while (starts.length > 0 && t - starts[0]! >= 1000) starts.shift();

      if (active < maxConcurrent && starts.length < perSecond) {
        starts.push(t);
        active++;
        return;
      }
      const wait = starts.length >= perSecond ? 1000 - (t - starts[0]!) : 20;
      await sleep(Math.max(wait, 1));
    }
  }

  return {
    async run(task) {
      await acquire();
      try {
        return await task();
      } finally {
        active--;
      }
    },
  };
}
