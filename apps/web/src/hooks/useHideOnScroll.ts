import { useEffect, useRef, useState } from 'react';
import { nextScrollState } from './scrollDirection';

/**
 * Diz se a barra do topo deve se esconder.
 * Quando `pinned` é true (painel aberto, busca em foco), ela fica sempre visível.
 */
export function useHideOnScroll(pinned: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  const state = useRef({ lastY: 0, hidden: false });

  useEffect(() => {
    let frame = 0;
    state.current = { lastY: window.scrollY, hidden: false };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        state.current = nextScrollState(state.current, window.scrollY);
        setHidden(state.current.hidden);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return hidden && !pinned;
}
