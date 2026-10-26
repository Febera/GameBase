import { ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { useSectionPreview } from '../../hooks/useSectionGames';
import { useSlowLoading } from '../../hooks/useSlowLoading';
import { PREVIEW_SIZE, type SectionDef } from '../../lib/sections';
import { ErrorState } from '../ui/ErrorState';
import { SlowServerNote } from '../ui/SlowServerNote';
import { CardRow } from './CardRow';

/** Faixa horizontal de uma seção da home. O título leva à lista completa. */
export function GameCarousel({ section }: { section: SectionDef }) {
  const { data, isPending, isError, error, refetch } = useSectionPreview(section);
  const slow = useSlowLoading(isPending);
  const headingId = `secao-${section.slug}`;

  const heading = (
    <h2 id={headingId} className="font-display text-2xl font-bold tracking-tight md:text-3xl">
      <Link to={`/secao/${section.slug}`} className="group inline-flex items-center gap-3">
        <span aria-hidden className="h-7 w-1.5 rounded-full bg-[var(--accent)]" />
        <span className="transition-colors group-hover:text-[var(--accent)]">{section.title}</span>
        <ChevronRight
          aria-hidden
          className="size-6 text-muted transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]"
        />
      </Link>
    </h2>
  );

  return (
    <section aria-labelledby={headingId} className="mb-14" style={{ '--accent': section.accent } as CSSProperties}>
      {isError ? (
        <>
          <div className="mb-4">{heading}</div>
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        </>
      ) : data && data.items.length === 0 ? (
        <>
          <div className="mb-4">{heading}</div>
          <p className="rounded-xl border border-dashed border-line px-5 py-8 text-muted">{section.emptyMessage}</p>
        </>
      ) : (
        <CardRow heading={heading} cards={data?.items.slice(0, PREVIEW_SIZE.carousel)} loading={isPending}>
          {slow && <SlowServerNote />}
        </CardRow>
      )}
    </section>
  );
}
