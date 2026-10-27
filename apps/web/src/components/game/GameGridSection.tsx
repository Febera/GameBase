import { ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { useSectionPreview } from '../../hooks/useSectionGames';
import { useSlowLoading } from '../../hooks/useSlowLoading';
import { PREVIEW_SIZE, type SectionDef } from '../../lib/sections';
import { SectionArt } from '../home/SectionArt';
import { SectionHeader } from '../home/SectionHeader';
import { ErrorState } from '../ui/ErrorState';
import { PendingNote } from '../ui/PendingNote';
import { SlowServerNote } from '../ui/SlowServerNote';
import { Card, CardSkeleton } from './Card';

/**
 * Quantos itens a grade com destaque mostra. O 1º ocupa 2 × 2: de 768px para cima, 17 jogos
 * fecham 4 colunas × 5 linhas ou 5 × 4. O 18º só aparece abaixo disso (2 e 3 colunas).
 */
const FEATURED_COUNT = 18;

/** Grade de 5 colunas × 4 linhas, com "Ver mais" no fim levando à lista completa. */
export function GameGridSection({ section, withArt = true }: { section: SectionDef; withArt?: boolean }) {
  const { data, isPending, isError, error, refetch } = useSectionPreview(section);
  const slow = useSlowLoading(isPending);
  const headingId = `secao-${section.slug}`;
  const href = `/secao/${section.slug}`;
  const featured = section.variant === 'featured';
  const size = featured ? FEATURED_COUNT : PREVIEW_SIZE.grid;
  const cards = data?.items.slice(0, size);

  /** No destaque: o 1º em 2 × 2 e o último só nas telas estreitas. */
  const cellClass = (i: number) =>
    featured ? (i === 0 ? 'md:col-span-2 md:row-span-2' : i === size - 1 ? 'md:hidden' : '') : '';

  return (
    <section
      aria-labelledby={headingId}
      className="relative isolate mb-16"
      style={{ '--accent': section.accent } as CSSProperties}
    >
      {withArt && <SectionArt kind={section.art} />}
      <SectionHeader
        id={headingId}
        href={href}
        title={section.title}
        subtitle={section.subtitle}
        icon={section.icon}
        total={data?.total}
      />

      {isError ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <>
          <p className="rounded-md border border-dashed border-line px-5 py-8 text-muted">{section.emptyMessage}</p>
          <PendingNote count={data.pending ?? 0} />
        </>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-5">
            {isPending || !cards
              ? Array.from({ length: size }, (_, i) => (
                  <li key={i} className={cellClass(i)}>
                    <CardSkeleton featured={featured && i === 0} />
                  </li>
                ))
              : cards.map((card, i) => (
                  <li key={card.key} className={`reveal ${cellClass(i)}`} style={{ '--i': i } as CSSProperties}>
                    <Card card={card} featured={featured && i === 0} />
                  </li>
                ))}
          </ul>
          {slow && <SlowServerNote />}
          {data && <PendingNote count={data.pending ?? 0} />}
          {data && data.total > (cards?.length ?? 0) && (
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
