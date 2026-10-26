import { type Clock, systemClock } from '../lib/time.js';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/** Por quanto tempo um valor vencido ainda pode ser servido enquanto é recarregado. */
const STALE_LIMIT_MS = 24 * 60 * 60 * 1000;

/**
 * Cache em memória com TTL por chave e limite de entradas (descarta a menos usada).
 * Requisições simultâneas para a mesma chave compartilham a mesma carga,
 * para não multiplicar chamadas às APIs externas.
 *
 * Observação: o conteúdo some quando o servidor reinicia ou hiberna (Render free).
 */
export class MemoryCache {
  private readonly store = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  /** Última versão de cada chave, guardada para getOrSetStale. */
  private readonly stale = new Map<string, Entry>();

  constructor(
    private readonly maxEntries = 500,
    private readonly now: Clock = systemClock,
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Reinsere para marcar como usada recentemente.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.stale.set(key, { value, expiresAt: this.now() + STALE_LIMIT_MS });
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
      this.stale.delete(oldest);
    }
  }

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const load = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, load);
    return load;
  }

  /**
   * Como getOrSet, mas se o valor venceu há pouco, devolve o antigo na hora e recarrega
   * em segundo plano. Bom para listas pesadas: ninguém espera a recarga depois da primeira vez.
   */
  async getOrSetStale<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const fresh = this.get<T>(key);
    if (fresh !== undefined) return fresh;

    const stale = this.stale.get(key);
    if (stale && stale.expiresAt > this.now()) {
      void this.getOrSet(key, ttlMs, loader).catch(() => {});
      return stale.value as T;
    }
    const value = await this.getOrSet(key, ttlMs, loader);
    return value;
  }

  get size(): number {
    return this.store.size;
  }
}
