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

/**
 * Formatos da consulta de avaliações, tentados em ordem até um responder JSON. A Steam devolve
 * a página HTML da loja quando não aceita os parâmetros (ex.: num_per_page=0).
 */
const REVIEW_URL_VARIANTS: ((appId: number) => string)[] = [
  (id) =>
    `https://store.steampowered.com/appreviews/${id}?json=1&filter=all&language=all&purchase_type=all&num_per_page=1`,
  (id) =>
    `https://store.steampowered.com/appreviews/${id}?json=1&filter=all&language=all&review_type=all&purchase_type=all&day_range=9223372036854775807&cursor=*&num_per_page=20`,
  (id) => `https://store.steampowered.com/appreviews/${id}?json=1`,
];
const REVIEW_HEADERS = {
  Accept: 'application/json',
  // Sem um navegador "conhecido", a Steam às vezes responde com a página da loja.
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GameBase',
};
/** Pausa da consulta direta quando nenhuma variante funciona. */
export const REVIEW_PAUSE_MS = 6 * 60 * 60 * 1000;

export function createSteamClient({
  fetchFn = fetch,
  now = systemClock,
  log = () => {},
}: { fetchFn?: typeof fetch; now?: Clock; log?: (message: string) => void } = {}): SteamClient {
  let reviewFailures = 0;
  /** Motivo de a Steam não ter devolvido as avaliações: as 3 primeiras vezes e depois 1 a cada 100. */
  function reviewFailed(appId: number, reason: string) {
    reviewFailures++;
    if (reviewFailures <= 3 || reviewFailures % 100 === 0) {
      log(`Steam: avaliações do app ${appId} não vieram (falha nº ${reviewFailures}): ${reason}`);
    }
  }

  /** Variante que respondeu JSON por último (começa pela primeira da lista). */
  let variant = 0;
  /** Quando nenhuma variante funciona, a consulta direta fica desligada até este instante. */
  let pausedUntil = 0;

  async function reviewSummary(appId: number): Promise<ReviewSummary | null> {
    if (now() < pausedUntil) return null;
    // Começa pela variante que funcionou da última vez; as outras só se ela vier em HTML.
    const order = [variant, ...REVIEW_URL_VARIANTS.keys()].filter((v, i, all) => all.indexOf(v) === i);
    try {
      for (const v of order) {
        const res = await fetchFn(REVIEW_URL_VARIANTS[v]!(appId), { headers: REVIEW_HEADERS });
        if (res.status === 429 || res.status === 403) {
          throw new UpstreamError('steam', res.status, `A Steam respondeu HTTP ${res.status}.`);
        }
        if (!res.ok) {
          reviewFailed(appId, `HTTP ${res.status}`);
          return null;
        }
        const text = await res.text();
        let body: { success?: number; query_summary?: ReviewSummary };
        try {
          body = JSON.parse(text) as typeof body;
        } catch {
          continue; // Página HTML: a Steam não aceitou esta variante; tenta a próxima.
        }
        if (v !== variant) {
          variant = v;
          log(`Steam: avaliações passaram a usar a variante ${v + 1} da consulta.`);
        }
        if (!body.success || !body.query_summary) {
          reviewFailed(appId, `success=${String(body.success)}, query_summary ${body.query_summary ? 'presente' : 'ausente'}`);
          return null;
        }
        if (body.query_summary.total_reviews === undefined) {
          reviewFailed(appId, `query_summary sem total_reviews (campos: ${Object.keys(body.query_summary).join(', ')})`);
        }
        return body.query_summary;
      }
      // Todas vieram em HTML: desliga por um tempo e deixa a reserva (ITAD) cuidar disso.
      pausedUntil = now() + REVIEW_PAUSE_MS;
      log(
        `Steam: nenhuma variante da consulta de avaliações respondeu JSON (app ${appId}); ` +
          `consulta direta desligada por ${REVIEW_PAUSE_MS / 3_600_000} h, usando a reserva.`,
      );
      return null;
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      reviewFailed(appId, String(error));
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
