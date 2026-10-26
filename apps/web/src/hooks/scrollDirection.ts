export interface ScrollState {
  lastY: number;
  hidden: boolean;
}

export interface ScrollOptions {
  /** Movimento mínimo, em px, para mudar de estado. Evita "piscar" com o touchpad. */
  threshold: number;
  /** Abaixo desta posição a barra sempre aparece. */
  revealAt: number;
}

export const DEFAULT_SCROLL_OPTIONS: ScrollOptions = { threshold: 8, revealAt: 64 };

/** Regra pura: esconde ao descer, mostra ao subir, sempre visível perto do topo. */
export function nextScrollState(
  state: ScrollState,
  y: number,
  options: ScrollOptions = DEFAULT_SCROLL_OPTIONS,
): ScrollState {
  if (y <= options.revealAt) return { lastY: y, hidden: false };
  const delta = y - state.lastY;
  if (Math.abs(delta) < options.threshold) return state;
  return { lastY: y, hidden: delta > 0 };
}
