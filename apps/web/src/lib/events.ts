/** Pede para a barra do topo abrir o painel de Opções (usado em avisos fora dela). */
export const OPEN_OPTIONS_EVENT = 'partida:abrir-opcoes';

export function openOptionsPanel() {
  window.dispatchEvent(new Event(OPEN_OPTIONS_EVENT));
}

/** Pede para a página de busca abrir e focar a barra lateral de filtros. */
export const OPEN_FILTERS_EVENT = 'partida:abrir-filtros';

export function focusFiltersSidebar() {
  window.dispatchEvent(new Event(OPEN_FILTERS_EVENT));
}
