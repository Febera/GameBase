import { describe, expect, it, vi } from 'vitest';
import { createTwitchAuth } from '../src/clients/twitchAuth.js';
import { UpstreamError } from '../src/lib/errors.js';
import { fakeClock, jsonResponse } from './helpers.js';

describe('createTwitchAuth', () => {
  it('reaproveita o token até perto de expirar', async () => {
    const clock = fakeClock();
    let n = 0;
    const fetchFn = vi.fn(async () =>
      jsonResponse({ access_token: `t${++n}`, expires_in: 3600 }),
    ) as unknown as typeof fetch;
    const auth = createTwitchAuth({ clientId: 'id', clientSecret: 's', fetchFn, now: clock.now });

    expect(await auth.getToken()).toBe('t1');
    clock.advance(30 * 60 * 1000);
    expect(await auth.getToken()).toBe('t1');
    clock.advance(26 * 60 * 1000); // passa da margem de renovação de 5 min
    expect(await auth.getToken()).toBe('t2');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('faz uma única requisição para chamadas simultâneas', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ access_token: 'tok', expires_in: 3600 }),
    ) as unknown as typeof fetch;
    const auth = createTwitchAuth({ clientId: 'id', clientSecret: 's', fetchFn });
    await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('explica o erro quando as credenciais são recusadas', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, 403)) as unknown as typeof fetch;
    const auth = createTwitchAuth({ clientId: 'id', clientSecret: 's', fetchFn });
    await expect(auth.getToken()).rejects.toBeInstanceOf(UpstreamError);
    await expect(auth.getToken()).rejects.toThrow(/TWITCH_CLIENT_ID/);
  });
});
