import type { SnapshotStore } from '../db/snapshotRepository.js';
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
 * O conteúdo some quando o servidor reinicia ou hiberna (Render free). Com um SnapshotStore
 * ligado (attachStore), as listas de getOrSetStale também ficam salvas no banco e voltam na
 * hora quando o servidor acorda.
 */
export class MemoryCache {
  private readonly store = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  /** Última versão de cada chave, guardada para getOrSetStale. */
  private readonly stale = new Map<string, Entry>();
  private snapshots: SnapshotStore | null = null;
  private log: (message: string) => void = () => {};

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

    // A cada carga nova, a versão também vai para o banco (quando ligado).
    const loadAndSave = () =>
      loader().then((value) => {
        this.saveSnapshot(key, value);
        return value;
      });

    let stale = this.stale.get(key);
    // Servidor recém-acordado: a memória está vazia, mas a última versão pode estar no banco.
    if (!stale && !this.inflight.has(key)) {
      stale = await this.loadSnapshot(key);
      if (stale) this.stale.set(key, stale);
    }
    if (stale && stale.expiresAt > this.now()) {
      void this.getOrSet(key, ttlMs, loadAndSave).catch(() => {});
      return stale.value as T;
    }
    const value = await this.getOrSet(key, ttlMs, loadAndSave);
    return value;
  }

  /** Liga a gravação das listas de getOrSetStale no banco. */
  attachStore(store: SnapshotStore, log: (message: string) => void = () => {}): void {
    this.snapshots = store;
    this.log = log;
  }

  /** Versão salva no banco, se ainda dentro do limite de "vencida mas servível". */
  private async loadSnapshot(key: string): Promise<Entry | undefined> {
    if (!this.snapshots) return undefined;
    try {
      const saved = await this.snapshots.load(key);
      if (!saved) return undefined;
      const expiresAt = saved.savedAt.getTime() + STALE_LIMIT_MS;
      return expiresAt > this.now() ? { value: saved.value, expiresAt } : undefined;
    } catch (error) {
      this.log(`Cache: falha ao ler "${key}" do banco: ${String(error)}`);
      return undefined;
    }
  }

  private saveSnapshot(key: string, value: unknown): void {
    this.snapshots?.save(key, value, new Date(this.now())).catch((error: unknown) => {
      this.log(`Cache: falha ao salvar "${key}" no banco: ${String(error)}`);
    });
  }

  get size(): number {
    return this.store.size;
  }
}
