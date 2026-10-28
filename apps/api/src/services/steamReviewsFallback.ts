import type { ItadClient } from '../clients/itad.js';
import type { SteamClient } from '../clients/steam.js';
import type { SteamApp } from '../db/steamAppsRepository.js';

/**
 * Completa as avaliações da Steam pela IsThereAnyDeal quando a consulta direta à Steam
 * (appreviews) não as traz. A ITAD guarda nota e total de avaliações da Steam de cada jogo;
 * é a mesma fonte que a página do jogo já usa.
 */
export function withItadReviews(steam: SteamClient, itad: ItadClient, log: (message: string) => void): SteamClient {
  if (!itad.configured) return steam;
  let failures = 0;

  async function fromItad(appId: number): Promise<SteamApp['reviews']> {
    try {
      const ids = await itad.itadIdsForSteam([appId]);
      const itadId = ids[`app/${appId}`];
      if (!itadId) return null;
      const info = await itad.gameInfo(itadId);
      const review = info.reviews?.find((r) => r.source === 'Steam' && r.score !== null && r.count);
      return review ? { total: review.count!, percent: review.score! } : null;
    } catch (error) {
      // Registra as primeiras falhas e depois uma a cada 100, para não inundar o log.
      failures++;
      if (failures <= 3 || failures % 100 === 0) {
        log(`Avaliações pela ITAD indisponíveis (app ${appId}, falha nº ${failures}): ${String(error)}`);
      }
      return null;
    }
  }

  return {
    ...steam,
    async appDetails(appId) {
      const app = await steam.appDetails(appId);
      if (!app.found || app.reviews) return app;
      const reviews = await fromItad(appId);
      return reviews ? { ...app, reviews } : app;
    },
    async reviews(appId) {
      return (await steam.reviews(appId)) ?? fromItad(appId);
    },
  };
}
