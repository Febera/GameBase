import { describe, expect, it, vi } from 'vitest';
import type { IgdbSteamLink, IgdbSteamRepository } from '../src/db/igdbSteamRepository.js';
import type { IgdbLookup } from '../src/services/igdbLookup.js';
import { LINK_TTL_MS, NO_LINK_TTL_MS, withPersistentSteamIds } from '../src/services/persistentLookup.js';
import { fakeClock } from './helpers.js';

function memoryRepo(initial: IgdbSteamLink[] = []): IgdbSteamRepository & { store: Map<number, IgdbSteamLink> } {
  const store = new Map(initial.map((l) => [l.igdbId, l]));
  return {
    store,
    async findByIgdb(ids) {
      return new Map(ids.flatMap((id) => (store.has(id) ? [[id, store.get(id)!] as const] : [])));
    },
    async findBySteam(appIds) {
      return new Map([...store.values()].flatMap((l) => (l.steamAppId && appIds.includes(l.steamAppId) ? [[l.steamAppId, l.igdbId] as const] : [])));
    },
    async upsertMany(links) {
      for (const l of links) store.set(l.igdbId, l);
    },
  };
}

function lookupWith(map: Record<number, number>): IgdbLookup & { steamAppIdsFor: ReturnType<typeof vi.fn> } {
  return {
    byTitles: async () => new Map(),
    bySteamAppIds: async () => new Map(),
    steamAppIdsFor: vi.fn(async (ids: number[]) => new Map(ids.flatMap((id) => (map[id] ? [[id, map[id]!] as const] : [])))),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('withPersistentSteamIds', () => {
  it('consulta a IGDB só para os jogos que não estão no banco, e guarda o resultado', async () => {
    const clock = fakeClock();
    const repo = memoryRepo([{ igdbId: 1, steamAppId: 10, checkedAt: new Date(clock.now()) }]);
    const inner = lookupWith({ 2: 20 });
    const lookup = withPersistentSteamIds(inner, repo, { now: clock.now });
    const result = await lookup.steamAppIdsFor([1, 2, 3]);
    expect([...result]).toEqual([
      [1, 10],
      [2, 20],
    ]);
    expect(inner.steamAppIdsFor).toHaveBeenCalledWith([2, 3]);
    await flush();
    expect(repo.store.get(3)).toMatchObject({ steamAppId: null }); // "sem Steam" também fica guardado
    inner.steamAppIdsFor.mockClear();
    await lookup.steamAppIdsFor([1, 2, 3]);
    expect(inner.steamAppIdsFor).not.toHaveBeenCalled();
  });

  it('confere de novo os vínculos vencidos: "sem Steam" em 7 dias, os demais em 30', async () => {
    const clock = fakeClock();
    const at = (ago: number) => new Date(clock.now() - ago);
    const repo = memoryRepo([
      { igdbId: 1, steamAppId: null, checkedAt: at(NO_LINK_TTL_MS + 1) },
      { igdbId: 2, steamAppId: 20, checkedAt: at(NO_LINK_TTL_MS + 1) },
      { igdbId: 3, steamAppId: 30, checkedAt: at(LINK_TTL_MS + 1) },
    ]);
    const inner = lookupWith({ 1: 11, 3: 30 });
    const result = await withPersistentSteamIds(inner, repo, { now: clock.now }).steamAppIdsFor([1, 2, 3]);
    expect(inner.steamAppIdsFor).toHaveBeenCalledWith([1, 3]);
    expect(result.get(1)).toBe(11);
    expect(result.get(2)).toBe(20);
  });

  it('banco fora do ar: cai para a IGDB', async () => {
    const repo = memoryRepo();
    repo.findByIgdb = async () => {
      throw new Error('sem conexão');
    };
    const inner = lookupWith({ 5: 50 });
    const log = vi.fn();
    const result = await withPersistentSteamIds(inner, repo, { log }).steamAppIdsFor([5]);
    expect(result.get(5)).toBe(50);
    expect(log).toHaveBeenCalledOnce();
  });
});
