import { describe, expect, it, vi } from 'vitest';
import type { IgdbClient } from '../src/clients/igdb.js';
import { UpstreamError } from '../src/lib/errors.js';
import { createIgdbLookup, normalizeTitle } from '../src/services/igdbLookup.js';

describe('normalizeTitle', () => {
  it('ignora maiúsculas, acentos, símbolos e pontuação', () => {
    expect(normalizeTitle('Pokémon™: Let’s Go!')).toBe('pokemon let s go');
    expect(normalizeTitle('Ratchet & Clank')).toBe(normalizeTitle('ratchet and clank'));
  });
});

describe('igdbLookup', () => {
  it('busca por títulos escapando aspas e prefere o jogo mais avaliado', async () => {
    const bodies: string[] = [];
    const igdb: IgdbClient = {
      query: vi.fn(async (_endpoint: string, body: string) => {
        bodies.push(body);
        return [
          { id: 1, name: 'Portal', slug: 'portal', total_rating_count: 10 },
          { id: 2, name: 'Portal', slug: 'portal-remake', total_rating_count: 900 },
        ];
      }) as IgdbClient['query'],
    };
    const result = await createIgdbLookup(igdb).byTitles(['Portal', 'Say "Hi"']);
    expect(result.get('portal')?.id).toBe(2);
    expect(bodies[0]).toContain('name ~ "Say \\"Hi\\""');
    expect(bodies[0]).toContain('platforms = (6)');
  });

  it('usa o campo antigo de fonte quando a IGDB recusa o novo', async () => {
    const igdb: IgdbClient = {
      query: vi.fn(async (_endpoint: string, body: string) => {
        if (body.includes('external_game_source')) throw new UpstreamError('igdb', 400, 'campo inválido');
        return [{ uid: '220', game: { id: 7, name: 'Half-Life 2', slug: 'hl2' } }];
      }) as IgdbClient['query'],
    };
    const result = await createIgdbLookup(igdb).bySteamAppIds(['220']);
    expect(result.get('220')?.id).toBe(7);
    expect(igdb.query).toHaveBeenCalledTimes(2);
  });
});

describe('igdbLookup.steamAppIdsFor', () => {
  it('devolve o primeiro App ID válido de cada jogo', async () => {
    const igdb: IgdbClient = {
      query: vi.fn(async () => [
        { uid: '1145360', game: 5 },
        { uid: '999', game: 5 },
        { uid: 'abc', game: 6 },
        { uid: '730', game: 7 },
      ]) as IgdbClient['query'],
    };
    const result = await createIgdbLookup(igdb).steamAppIdsFor([5, 6, 7]);
    expect([...result.entries()]).toEqual([
      [5, 1145360],
      [7, 730],
    ]);
  });

  it('pagina a resposta: jogos com muitos vínculos não ficam sem App ID', async () => {
    const bodies: string[] = [];
    const igdb: IgdbClient = {
      query: vi.fn(async (_endpoint: string, body: string) => {
        bodies.push(body);
        // 1ª página cheia (500 linhas do jogo 1), 2ª com o jogo 2.
        if (body.includes('offset 0;')) return Array.from({ length: 500 }, (_, i) => ({ uid: String(100 + i), game: 1 }));
        return [{ uid: '730', game: 2 }];
      }) as IgdbClient['query'],
    };
    const result = await createIgdbLookup(igdb).steamAppIdsFor([1, 2]);
    expect(result.get(1)).toBe(100);
    expect(result.get(2)).toBe(730);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toContain('offset 500;');
  });
});
