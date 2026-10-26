import type { SteamClient } from '../clients/steam.js';
import type { SteamApp, SteamAppsRepository } from '../db/steamAppsRepository.js';
import { UpstreamError } from '../lib/errors.js';
import { type Clock, type Sleep, realSleep, systemClock } from '../lib/time.js';

/** Depois disso os dados (principalmente o preço) são buscados de novo. */
export const STEAM_STALE_MS = 12 * 60 * 60 * 1000;
/**
 * Intervalo entre consultas. A loja da Steam aceita algo perto de 200 por 5 minutos;
 * 1,6 s dá ~187, com folga.
 */
const DEFAULT_DELAY_MS = 1600;
/** Pausa após a Steam pedir para desacelerar (HTTP 429 ou 403). */
const BACKOFF_MS = 2 * 60 * 1000;

export interface SteamSync {
  /** Dados já guardados (mesmo que antigos) e quantos ainda faltam buscar. */
  read(appIds: number[]): Promise<{ apps: Map<number, SteamApp>; pending: number }>;
  /**
   * Coloca na fila os jogos que não estão no banco ou estão desatualizados.
   * "high" (padrão): jogos que alguém está vendo agora. "low": listas grandes em segundo plano.
   */
  refresh(appIds: number[], priority?: 'high' | 'low'): Promise<void>;
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

/**
 * Fila de jogos para buscar na Steam, processada um por vez, no ritmo que a loja aceita.
 * Tudo vai para o banco, então o progresso sobrevive a reinícios e à hibernação do servidor.
 */
export function createSteamSync({
  steam,
  repo,
  now = systemClock,
  sleep = realSleep,
  delayMs = DEFAULT_DELAY_MS,
  log = () => {},
}: Deps): SteamSync {
  const high: number[] = [];
  const low: number[] = [];
  const queuedSet = new Set<number>();
  /** Próximo da fila: sempre os de alta prioridade primeiro. */
  const next = () => (high.length ? high : low);
  const size = () => high.length + low.length;
  let running: Promise<void> | null = null;

  async function work() {
    while (size() > 0) {
      const queue = next();
      const appId = queue[0]!;
      try {
        await repo.upsert(await steam.appDetails(appId));
        queue.shift();
        queuedSet.delete(appId);
        await sleep(delayMs);
      } catch (error) {
        if (error instanceof UpstreamError && (error.status === 429 || error.status === 403)) {
          log(`Steam pediu para desacelerar; pausando ${BACKOFF_MS / 60000} min (${size()} na fila).`);
          await sleep(BACKOFF_MS);
        } else {
          // Erro pontual: tenta de novo numa próxima atualização, sem travar a fila.
          log(`Steam: falha no app ${appId}: ${String(error)}`);
          queue.shift();
          queuedSet.delete(appId);
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

    async refresh(appIds, priority = 'high') {
      const stored = await repo.findMany(appIds);
      const limit = now() - STEAM_STALE_MS;
      // Primeiro os que faltam (afetam quais jogos aparecem), depois os desatualizados.
      const missing = appIds.filter((id) => !stored.has(id));
      const stale = appIds.filter((id) => {
        const app = stored.get(id);
        return app !== undefined && app.fetchedAt.getTime() < limit;
      });
      const target = priority === 'high' ? high : low;
      for (const id of [...missing, ...stale]) {
        if (!queuedSet.has(id)) {
          queuedSet.add(id);
          target.push(id);
        } else if (priority === 'high' && low.includes(id)) {
          // Já estava na fila lenta: passa para a frente.
          low.splice(low.indexOf(id), 1);
          high.push(id);
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
