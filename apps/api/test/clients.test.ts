import { describe, expect, it, vi } from 'vitest';
import { createGamerPowerClient } from '../src/clients/gamerpower.js';
import { createItadClient } from '../src/clients/itad.js';
import { MissingConfigError, UpstreamError } from '../src/lib/errors.js';
import { jsonResponse } from './helpers.js';

describe('GamerPower', () => {
  it('trata 201 como lista vazia', async () => {
    const client = createGamerPowerClient((async () => jsonResponse({ status: 0 }, 201)) as unknown as typeof fetch);
    expect(await client.pcGameGiveaways()).toEqual([]);
  });

  it('ignora itens fora do formato sem derrubar a lista', async () => {
    const client = createGamerPowerClient(
      (async () => jsonResponse([{ id: 1, title: 'Ok' }, { title: 'Sem id' }])) as unknown as typeof fetch,
    );
    const list = await client.pcGameGiveaways();
    expect(list).toHaveLength(1);
    expect(list[0]?.worth).toBe('N/A');
  });
});

describe('IsThereAnyDeal', () => {
  it('lança MissingConfigError sem chave', async () => {
    const client = createItadClient({ apiKey: undefined, fetchFn: vi.fn() as unknown as typeof fetch });
    expect(client.configured).toBe(false);
    await expect(
      client.deals({ offset: 0, limit: 10, country: 'BR', minCut: 75, maxCut: 99, mature: false }),
    ).rejects.toBeInstanceOf(MissingConfigError);
  });

  it('envia a chave no cabeçalho e os filtros no corpo, em JSON', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ nextOffset: 0, hasMore: false, list: [] }));
    const client = createItadClient({ apiKey: 'segredo', fetchFn: fetchFn as unknown as typeof fetch });
    await client.deals({ offset: 200, limit: 200, country: 'BR', minCut: 70, maxCut: 99, mature: false });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.isthereanydeal.com/deals/v2');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      country: 'BR',
      offset: 200,
      limit: 200,
      sort: '-cut',
      mature: false,
      filter: { cut: { min: 70, max: 99 } },
    });
    expect(url).not.toContain('segredo');
    expect(init.headers).toMatchObject({ 'ITAD-API-Key': 'segredo', 'Content-Type': 'application/json' });
  });

  it('explica quando a chave é recusada', async () => {
    const client = createItadClient({
      apiKey: 'errada',
      fetchFn: (async () => jsonResponse({}, 403)) as unknown as typeof fetch,
    });
    const error = await client.lookupByTitle('X').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as Error).message).toContain('ITAD_API_KEY');
  });
});
