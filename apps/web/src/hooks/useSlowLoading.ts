import { useEffect, useState } from 'react';

/**
 * Fica true quando um carregamento passa de `delayMs`.
 * Usado para avisar que o servidor gratuito pode estar acordando.
 */
export function useSlowLoading(loading: boolean, delayMs = 6000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [loading, delayMs]);
  return slow;
}
