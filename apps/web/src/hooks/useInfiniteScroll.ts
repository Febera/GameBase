import { useEffect, useRef } from 'react';

/** Chama `onReach` quando o elemento sentinela chega perto da área visível. */
export function useInfiniteScroll(onReach: () => void, enabled: boolean) {
  const sentinel = useRef<HTMLDivElement>(null);
  const callback = useRef(onReach);
  callback.current = onReach;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinel;
}
