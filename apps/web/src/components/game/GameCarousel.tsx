import type { CSSProperties } from 'react';
import { useSectionPreview } from '../../hooks/useSectionGames';
import { useSlowLoading } from '../../hooks/useSlowLoading';
import { endsSoon } from '../../lib/cards';
import { PREVIEW_SIZE, type SectionDef } from '../../lib/sections';
import { SectionArt } from '../home/SectionArt';
import { SectionHeader } from '../home/SectionHeader';
import { TicketCard, TicketSkeleton } from '../home/TicketCard';
import { ErrorState } from '../ui/ErrorState';
import { SlowServerNote } from '../ui/SlowServerNote';
import { CardRow } from './CardRow';

/** Faixa horizontal de uma seção da home. O título leva à lista completa. */
export function GameCarousel({ section, withArt = true }: { section: SectionDef; withArt?: boolean }) {
  const { data, isPending, isError, error, refetch } = useSectionPreview(section);
  const slow = useSlowLoading(isPending);
  const headingId = `secao-${section.slug}`;
  const cards = data?.items.slice(0, PREVIEW_SIZE.carousel);
  const tickets = section.variant === 'tickets';

  // Nos cupons, quantos terminam nos próximos 7 dias (entre os que aparecem na home).
  const soon = tickets && cards ? cards.filter((card) => endsSoon(card.endsAt)).length : 0;
  const highlight = soon > 0 ? (soon === 1 ? '1 acaba esta semana' : `${soon} acabam esta semana`) : null;

  const heading = (
    <SectionHeader
      id={headingId}
      href={`/secao/${section.slug}`}
      title={section.title}
      subtitle={section.subtitle}
      icon={section.icon}
      total={data?.total}
      highlight={highlight}
    />
  );

  return (
    <section
      aria-labelledby={headingId}
      className="relative isolate mb-16"
      style={{ '--accent': section.accent } as CSSProperties}
    >
      {withArt && <SectionArt kind={section.art} />}
      {isError ? (
        <>
          {heading}
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        </>
      ) : data && data.items.length === 0 ? (
        <>
          {heading}
          <p className="rounded-md border border-dashed border-line px-5 py-8 text-muted">{section.emptyMessage}</p>
        </>
      ) : (
        <CardRow
          heading={heading}
          cards={cards}
          loading={isPending}
          {...(tickets && {
            renderCard: (card) => <TicketCard card={card} />,
            skeleton: <TicketSkeleton />,
            trackClassName: 'ticket-track',
          })}
        >
          {slow && <SlowServerNote />}
        </CardRow>
      )}
    </section>
  );
}
