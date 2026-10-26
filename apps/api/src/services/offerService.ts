import type { AdultMode, OfferDetails } from '@rj/shared';
import { AdultContentError, NotFoundError, UpstreamError } from '../lib/errors.js';
import type { AdultContentFilter } from './adultContent.js';
import type { IgdbLookup } from './igdbLookup.js';
import type { GiveawaysService } from './giveawaysService.js';
import type { ItadPricing } from './itadPricing.js';

interface Deps {
  pricing: ItadPricing;
  lookup: IgdbLookup;
  adult: AdultContentFilter;
  giveaways?: Pick<GiveawaysService, 'findFor'>;
}

export interface OfferService {
  getOffer(itadId: string, adult: AdultMode): Promise<OfferDetails>;
}

/** Página de oferta para jogos da ITAD; quando o jogo existe na IGDB, informa o ID para redirecionar. */
export function createOfferService({ pricing, lookup, adult, giveaways }: Deps): OfferService {
  return {
    async getOffer(itadId, adultMode) {
      let data;
      try {
        data = await pricing.forItadId(itadId);
      } catch (error) {
        if (error instanceof UpstreamError && [400, 404].includes(error.status)) {
          throw new NotFoundError('Oferta não encontrada.');
        }
        throw error;
      }
      const info = data.info;
      if (!info?.title) throw new NotFoundError('Oferta não encontrada.');

      const appId = info.appid ?? null;
      const igdbGame = appId ? (await lookup.bySteamAppIds([String(appId)]).catch(() => new Map())).get(String(appId)) : undefined;
      const igdbAdult = igdbGame ? (await adult.adultIgdbIds([igdbGame.id])).has(igdbGame.id) : false;
      if ((data.mature || igdbAdult) && adultMode === 'hide') throw new AdultContentError();

      const giveaway = giveaways ? await giveaways.findFor({ itadId }, adultMode) : null;
      const assets = info.assets ?? {};
      return {
        id: itadId,
        title: info.title,
        banner: assets.banner600 ?? assets.banner400 ?? assets.banner300 ?? null,
        boxart: assets.boxart ?? null,
        igdbId: igdbGame?.id ?? null,
        releaseDate: info.releaseDate ?? null,
        developers: (info.developers ?? []).map((d) => d.name),
        publishers: (info.publishers ?? []).map((p) => p.name),
        tags: info.tags ?? [],
        steamReviews: data.steamReviews,
        steamUrl: appId ? `https://store.steampowered.com/app/${appId}/` : null,
        offers: data.offers,
        historyLow: data.historyLow,
        yearLow: data.yearLow,
        giveaway,
      };
    },
  };
}
