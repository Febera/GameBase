import type { SteamApp } from '../db/steamAppsRepository.js';
import { UpstreamError } from '../lib/errors.js';
import { type Clock, systemClock } from '../lib/time.js';

/**
 * Descritores de conteúdo da Steam que indicam foco em conteúdo sexual:
 * 3 = conteúdo sexual explícito (só adultos), 4 = nudez ou temas sexuais como foco principal.
 * O 1 ("alguma nudez") fica de fora de propósito: marcaria jogos mainstream.
 */
export const STEAM_ADULT_DESCRIPTORS = [3, 4];

interface AppDetailsData {
  is_free?: boolean;
  demos?: { appid: number }[];
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
  };
  content_descriptors?: { ids?: number[] | null };
}

interface ReviewSummary {
  total_positive?: number;
  total_reviews?: number;
}

export interface SteamClient {
  /** Dados da loja de um jogo, já no formato guardado no banco. */
  appDetails(appId: number): Promise<SteamApp>;
}

/** Converte a resposta da Steam. `null` quando a loja não tem a página do jogo. */
export function parseAppDetails(
  appId: number,
  data: AppDetailsData | null,
  fetchedAt: Date,
  summary: ReviewSummary | null = null,
): SteamApp {
  if (!data) {
    return { appId, found: false, isFree: null, hasDemo: null, adultContent: false, price: null, reviews: null, fetchedAt };
  }
  const descriptors = data.content_descriptors?.ids ?? [];
  const price = data.price_overview;
  return {
    appId,
    found: true,
    isFree: Boolean(data.is_free),
    hasDemo: (data.demos?.length ?? 0) > 0,
    adultContent: descriptors.some((id) => STEAM_ADULT_DESCRIPTORS.includes(id)),
    price:
      !data.is_free && price
        ? {
            currency: price.currency,
            initial: price.initial,
            final: price.final,
            discountPercent: price.discount_percent,
          }
        : null,
    reviews: parseReviews(summary),
    fetchedAt,
  };
}

/** Total de avaliações e % positivas; null quando o jogo ainda não tem avaliações. */
export function parseReviews(summary: ReviewSummary | null): SteamApp['reviews'] {
  const total = summary?.total_reviews ?? 0;
  if (!summary || total <= 0) return null;
  return { total, percent: Math.round(((summary.total_positive ?? 0) / total) * 100) };
}

export function createSteamClient({
  fetchFn = fetch,
  now = systemClock,
}: { fetchFn?: typeof fetch; now?: Clock } = {}): SteamClient {
  async function reviewSummary(appId: number): Promise<ReviewSummary | null> {
    try {
      const res = await fetchFn(
        `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`,
        { headers: { Accept: 'application/json' } },
      );
      if (res.status === 429 || res.status === 403) {
        throw new UpstreamError('steam', res.status, `A Steam respondeu HTTP ${res.status}.`);
      }
      if (!res.ok) return null;
      const body = (await res.json()) as { success?: number; query_summary?: ReviewSummary };
      return body.success ? (body.query_summary ?? null) : null;
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      return null;
    }
  }

  return {
    async appDetails(appId) {
      // Sem "filters": o filtro "basic" removeria os descritores de conteúdo.
      const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=br&l=portuguese`;
      let res: Response;
      try {
        res = await fetchFn(url, { headers: { Accept: 'application/json' } });
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        throw new UpstreamError('steam', 0, `Sem conexão com a Steam: ${reason}`);
      }
      if (!res.ok) throw new UpstreamError('steam', res.status, `A Steam respondeu HTTP ${res.status}.`);

      const body = (await res.json()) as Record<string, { success: boolean; data?: AppDetailsData }> | null;
      const entry = body?.[String(appId)];
      const data = entry?.success && entry.data ? entry.data : null;
      // Avaliações vêm de outra consulta; sem elas, o jogo segue com reviews = null.
      const summary = data ? await reviewSummary(appId) : null;
      return parseAppDetails(appId, data, new Date(now()), summary);
    },
  };
}
