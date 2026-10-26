import { ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { useSectionPreview } from '../../hooks/useSectionGames';
import { useSlowLoading } from '../../hooks/useSlowLoading';
import { PREVIEW_SIZE, type SectionDef } from '../../lib/sections';
import { ErrorState } from '../ui/ErrorState';
import { PendingNote } from '../ui/PendingNote';
import { SlowServerNote } from '../ui/SlowServerNote';
import { Card, CardSkeleton } from './Card';

/** Grade de 5 colunas × 4 linhas, com "Ver mais" no fim levando à lista completa. */
export function GameGridSection({ section }: { section: SectionDef }) {
  const { data, isPending, isError, error, refetch } = useSectionPreview(section);
  const slow = useSlowLoading(isPending);
  const headingId = `secao-${section.slug}`;
  const href = `/secao/${section.slug}`;
  const size = PREVIEW_SIZE.grid;

  return (
    <section aria-labelledby={headingId} className="mb-16" style={{ '--accent': section.accent } as CSSProperties}>
      <h2 id={headingId} className="mb-4 font-display text-2xl font-bold tracking-tight md:text-3xl">
        <Link to={href} className="group inline-flex items-center gap-3">
          <span aria-hidden className="h-7 w-1.5 rounded-full bg-[var(--accent)]" />
          <span className="transition-colors group-hover:text-[var(--accent)]">{section.title}</span>
          <ChevronRight
            aria-hidden
            className="size-6 text-muted transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]"
          />
        </Link>
      </h2>

      {isError ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <>
          <p className="rounded-xl border border-dashed border-line px-5 py-8 text-muted">{section.emptyMessage}</p>
          <PendingNote count={data.pending ?? 0} />
        </>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-5">
            {isPending
              ? Array.from({ length: size }, (_, i) => (
                  <li key={i}>
                    <CardSkeleton />
                  </li>
                ))
              : data.items.slice(0, size).map((card, i) => (
                  <li key={card.key} className="reveal" style={{ '--i': i } as CSSProperties}>
                    <Card card={card} />
                  </li>
                ))}
          </ul>
          {slow && <SlowServerNote />}
          {data && <PendingNote count={data.pending ?? 0} />}
          {data && data.total > size && (
            <div className="mt-4 text-right">
              <Link
                to={href}
                className="inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-[var(--accent)]"
              >
                Ver mais
                <ChevronRight aria-hidden className="size-4" />
                <span className="sr-only">: {section.title}</span>
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
