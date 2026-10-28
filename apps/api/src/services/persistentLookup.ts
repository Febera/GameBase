import type { IgdbSteamRepository } from '../db/igdbSteamRepository.js';
import { type Clock, systemClock } from '../lib/time.js';
import type { IgdbLookup } from './igdbLookup.js';

/** Vínculos encontrados valem por 30 dias; "sem Steam" é conferido de novo em 7 (vínculos novos aparecem). */
export const LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NO_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Guarda no banco o vínculo IGDB → Steam: a IGDB só é consultada para jogos ainda não vistos
 * (ou com vínculo vencido). Se o banco falhar, cai direto para a IGDB, como antes.
 */
export function withPersistentSteamIds(
  lookup: IgdbLookup,
  repo: IgdbSteamRepository,
  { now = systemClock, log = () => {} }: { now?: Clock; log?: (message: string) => void } = {},
): IgdbLookup {
  function save(links: { igdbId: number; steamAppId: number | null }[]) {
    const checkedAt = new Date(now());
    repo
      .upsertMany(links.map((l) => ({ ...l, checkedAt })))
      .catch((error: unknown) => log(`Vínculos IGDB → Steam: falha ao salvar: ${String(error)}`));
  }

  return {
    ...lookup,

    async steamAppIdsFor(igdbIds) {
      const unique = [...new Set(igdbIds)];
      let stored = new Map<number, { steamAppId: number | null; checkedAt: Date }>();
      try {
        stored = await repo.findByIgdb(unique);
      } catch (error) {
        log(`Vínculos IGDB → Steam: banco indisponível, consultando a IGDB: ${String(error)}`);
        return lookup.steamAppIdsFor(unique);
      }
      const result = new Map<number, number>();
      const missing: number[] = [];
      for (const id of unique) {
        const link = stored.get(id);
        const ttl = link?.steamAppId ? LINK_TTL_MS : NO_LINK_TTL_MS;
        if (link && link.checkedAt.getTime() > now() - ttl) {
          if (link.steamAppId) result.set(id, link.steamAppId);
        } else {
          missing.push(id);
        }
      }
      if (missing.length) {
        const fetched = await lookup.steamAppIdsFor(missing);
        for (const [igdbId, appId] of fetched) result.set(igdbId, appId);
        save(missing.map((igdbId) => ({ igdbId, steamAppId: fetched.get(igdbId) ?? null })));
      }
      return result;
    },

    async bySteamAppIds(appIds) {
      const games = await lookup.bySteamAppIds(appIds);
      // Aproveita a resposta para guardar o vínculo (útil para o ranking por avaliações).
      const links = [...games].flatMap(([uid, game]) => {
        const appId = Number(uid);
        return Number.isInteger(appId) && appId > 0 ? [{ igdbId: game.id, steamAppId: appId }] : [];
      });
      if (links.length) save(links);
      return games;
    },
  };
}
