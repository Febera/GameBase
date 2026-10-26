import { BASE_URL } from './apiClient';

type Listener = (igdbId: number | null) => void;

/**
 * Conexão ao vivo com o placar (Server-Sent Events), compartilhada por toda a página:
 * abre quando o primeiro componente precisa e fecha quando o último sai.
 * O navegador reconecta sozinho se a conexão cair (ex.: servidor acordando).
 */
const listeners = new Set<Listener>();
let source: EventSource | null = null;

function open() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource(new URL('/api/recommendations/events', BASE_URL));
  source.addEventListener('changed', (event) => {
    let igdbId: number | null = null;
    try {
      igdbId = (JSON.parse((event as MessageEvent<string>).data) as { igdbId?: number }).igdbId ?? null;
    } catch {
      // Evento sem dados: atualiza tudo.
    }
    for (const listener of listeners) listener(igdbId);
  });
}

export function subscribeToRecommendations(listener: Listener): () => void {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      source?.close();
      source = null;
    }
  };
}
