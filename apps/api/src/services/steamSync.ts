import { PRICE_BATCH_SIZE, type SteamClient } from '../clients/steam.js';
import type { SteamApp, SteamAppsRepository } from '../db/steamAppsRepository.js';
import { UpstreamError } from '../lib/errors.js';
import { type Clock, type Sleep, realSleep, systemClock } from '../lib/time.js';

/*
 * Cada dado da Steam vence no seu ritmo:
 * - preço muda com as promoções: 12 h, e é atualizado em lote (muitos jogos por consulta);
 * - avaliações mudam devagar: 7 dias;
 * - detalhes (grátis, demo, conteúdo adulto) quase nunca: 7 dias, numa consulta completa
 *   que também traz preço e avaliações.
 */
export const PRICE_STALE_MS = 12 * 60 * 60 * 1000;
export const REVIEWS_STALE_MS = 7 * 24 * 60 * 60 * 1000;
export const DETAILS_STALE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Jogos guardados sem avaliações voltam para a fila depois disso, quando quem pede precisa
 * delas (ordenação por nota).
 */
export const MISSING_REVIEWS_RETRY_MS = 60 * 60 * 1000;
/**
 * Intervalo entre consultas. A loja da Steam aceita algo perto de 200 por 5 minutos;
 * 1,6 s dá ~187, com folga.
 */
const DEFAULT_DELAY_MS = 1600;
/** Pausa após a Steam pedir para desacelerar (HTTP 429 ou 403). */
const BACKOFF_MS = 2 * 60 * 1000;

type JobKind = 'details' | 'price' | 'reviews';
interface Job {
  kind: JobKind;
  appId: number;
}

export interface RefreshOptions {
  /** Rebusca quem está sem avaliações há mais de 1 h (ordenação por nota). */
  needReviews?: boolean;
  /** Não atualiza preço: a lista já tem o preço de outra fonte (ofertas da ITAD). */
  skipPrice?: boolean;
}

export interface SteamSync {
  /** Dados já guardados (mesmo que antigos) e quantos ainda faltam buscar. */
  read(appIds: number[]): Promise<{ apps: Map<number, SteamApp>; pending: number }>;
  /**
   * Coloca na fila o que falta ou venceu de cada jogo.
   * "high" (padrão): jogos que alguém está vendo agora. "low": listas grandes em segundo plano.
   */
  refresh(appIds: number[], priority?: 'high' | 'low', options?: RefreshOptions): Promise<void>;
  /** Tamanho atual da fila (para logs e testes). */
  readonly queued: number;
  /** Termina quando a fila esvazia (usado nos testes). */
  idle(): Promise<void>;
}

interface Deps {
  steam: SteamClient;
  repo: SteamAppsRepository;
  now?: Clock;
  sleep?: Sleep;
  delayMs?: number;
  log?: (message: string) => void;
}

/** O que falta buscar de um jogo, pelo que está guardado. */
export function jobsFor(app: SteamApp | undefined, nowMs: number, options: RefreshOptions = {}): JobKind[] {
  if (!app || app.fetchedAt.getTime() < nowMs - DETAILS_STALE_MS) return ['details'];
  if (!app.found) return [];
  const jobs: JobKind[] = [];
  const priceAt = (app.priceFetchedAt ?? app.fetchedAt).getTime();
  if (!options.skipPrice && !app.isFree && priceAt < nowMs - PRICE_STALE_MS) jobs.push('price');
  const reviewsAt = (app.reviewsFetchedAt ?? app.fetchedAt).getTime();
  const reviewsStale = reviewsAt < nowMs - REVIEWS_STALE_MS;
  const retryMissing = options.needReviews && !app.reviews && reviewsAt < nowMs - MISSING_REVIEWS_RETRY_MS;
  if (reviewsStale || retryMissing) jobs.push('reviews');
  return jobs;
}

/**
 * Fila de consultas à Steam, processada uma por vez, no ritmo que a loja aceita. Preços
 * pendentes saem juntos, em lote. Tudo vai para o banco, então o progresso sobrevive a
 * reinícios e à hibernação do servidor.
 */
export function createSteamSync({
  steam,
  repo,
  now = systemClock,
  sleep = realSleep,
  delayMs = DEFAULT_DELAY_MS,
  log = () => {},
}: Deps): SteamSync {
  const high: Job[] = [];
  const low: Job[] = [];
  const queuedKeys = new Set<string>();
  const key = (job: Job) => `${job.kind}:${job.appId}`;
  /** Próximo da fila: sempre os de alta prioridade primeiro. */
  const next = () => (high.length ? high : low);
  const size = () => high.length + low.length;
  let running: Promise<void> | null = null;

  /** Tira da fila os jobs de preço (até o tamanho do lote), começando pelo primeiro. */
  function takePriceBatch(queue: Job[]): Job[] {
    const batch: Job[] = [];
    for (let i = 0; i < queue.length && batch.length < PRICE_BATCH_SIZE; ) {
      if (queue[i]!.kind === 'price') batch.push(...queue.splice(i, 1));
      else i++;
    }
    return batch;
  }

  async function run(queue: Job[]): Promise<void> {
    const job = queue[0]!;
    if (job.kind === 'price') {
      const batch = takePriceBatch(queue);
      try {
        const prices = await steam.prices(batch.map((j) => j.appId));
        await repo.updatePrices(
          [...prices].map(([appId, price]) => ({ appId, price })),
          new Date(now()),
        );
      } catch (error) {
        // Devolve o lote para a frente da fila: tenta de novo depois da pausa.
        queue.unshift(...batch);
        throw error;
      }
      for (const j of batch) queuedKeys.delete(key(j));
      return;
    }
    if (job.kind === 'details') await repo.upsert(await steam.appDetails(job.appId));
    else await repo.updateReviews(job.appId, await steam.reviews(job.appId), new Date(now()));
    queue.shift();
    queuedKeys.delete(key(job));
  }

  async function work() {
    while (size() > 0) {
      const queue = next();
      try {
        await run(queue);
        await sleep(delayMs);
      } catch (error) {
        if (error instanceof UpstreamError && (error.status === 429 || error.status === 403)) {
          log(`Steam pediu para desacelerar; pausando ${BACKOFF_MS / 60000} min (${size()} na fila).`);
          await sleep(BACKOFF_MS);
        } else {
          // Erro pontual: descarta e tenta de novo numa próxima atualização, sem travar a fila.
          const job = queue.shift();
          if (job) {
            queuedKeys.delete(key(job));
            log(`Steam: falha (${job.kind}) no app ${job.appId}: ${String(error)}`);
          }
          await sleep(delayMs);
        }
      }
    }
  }

  function start() {
    running ??= work().finally(() => {
      running = null;
    });
  }

  return {
    async read(appIds) {
      const apps = await repo.findMany(appIds);
      return { apps, pending: appIds.filter((id) => !apps.has(id)).length };
    },

    async refresh(appIds, priority = 'high', options = {}) {
      const stored = await repo.findMany(appIds);
      const nowMs = now();
      // Primeiro os que faltam no banco (afetam quais jogos aparecem), depois o resto.
      const missing = appIds.filter((id) => !stored.has(id));
      const known = appIds.filter((id) => stored.has(id));
      const target = priority === 'high' ? high : low;
      for (const appId of [...missing, ...known]) {
        for (const kind of jobsFor(stored.get(appId), nowMs, options)) {
          const job = { kind, appId };
          const k = key(job);
          if (!queuedKeys.has(k)) {
            queuedKeys.add(k);
            target.push(job);
          } else if (priority === 'high') {
            // Já estava na fila lenta: passa para a frente.
            const i = low.findIndex((j) => key(j) === k);
            if (i >= 0) high.push(...low.splice(i, 1));
          }
        }
      }
      if (size() > 0) start();
    },

    get queued() {
      return size();
    },

    async idle() {
      while (running) await running;
    },
  };
}
