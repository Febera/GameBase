import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type RefObject, useCallback, useEffect, useState } from 'react';

interface Props {
  /** Elemento com rolagem horizontal. */
  track: RefObject<HTMLElement | null>;
  /** Muda quando o conteúdo muda, para recalcular as pontas. */
  contentKey?: unknown;
  labels?: { previous: string; next: string };
}

/**
 * Setas nas extremidades de uma faixa horizontal, centralizadas na altura dela.
 * Cada seta só aparece quando há conteúdo naquela direção. Ocultas no celular (rola com o dedo).
 * O elemento pai precisa ter `position: relative`.
 */
export function EdgeArrows({ track, contentKey, labels = { previous: 'Anteriores', next: 'Próximos' } }: Props) {
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, [track]);

  useEffect(() => {
    const el = track.current;
    update();
    el?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [track, update, contentKey]);

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  const base =
    'absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/95 text-ink shadow-lg backdrop-blur transition hover:bg-surface-2 sm:flex';

  return (
    <>
      {!edges.start && (
        <button type="button" aria-label={labels.previous} onClick={() => scroll(-1)} className={`${base} left-0 -translate-x-1/2`}>
          <ChevronLeft className="size-6" aria-hidden />
        </button>
      )}
      {!edges.end && (
        <button type="button" aria-label={labels.next} onClick={() => scroll(1)} className={`${base} right-0 translate-x-1/2`}>
          <ChevronRight className="size-6" aria-hidden />
        </button>
      )}
    </>
  );
}
