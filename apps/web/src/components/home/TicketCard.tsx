import { Clock } from 'lucide-react';
import { type CardModel, endsLabel, endsSoon } from '../../lib/cards';
import { CardAnchor } from '../game/Card';

/**
 * Card de "Grátis por tempo limitado" em forma de cupom: capa à esquerda, picote, e à direita
 * o nome, a loja, o valor que deixa de pagar e o prazo. O picote tem furos de verdade (máscara).
 * Fundo liso com um leve tom da cor da seção.
 */
export function TicketCard({ card }: { card: CardModel }) {
  const image = card.cover?.url ?? card.fallbackImage;
  const ends = endsLabel(card.endsAt);
  const soon = endsSoon(card.endsAt);

  return (
    <CardAnchor card={card} className="ticket group relative flex h-[9.75rem] rounded-md bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))] ring-1 ring-line">
      <div className="relative w-[var(--ticket-stub)] shrink-0 p-2.5">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="ticket-cover size-full rounded-sm object-cover shadow-[0_6px_18px_-6px_rgb(0_0_0/0.6)]"
          />
        ) : (
          <div className="size-full rounded-sm bg-surface-2" />
        )}
      </div>

      <span aria-hidden className="relative my-3.5 w-0 border-l-2 border-dashed border-line-strong" />

      <div className="relative flex min-w-0 flex-1 flex-col justify-between py-3.5 pl-4 pr-3.5">
        <div className="min-w-0">
          {card.note && <p className="truncate text-xs font-semibold text-[var(--accent)]">{card.note}</p>}
          <p className="mt-0.5 line-clamp-2 font-display text-[1.05rem] font-bold leading-tight text-ink">{card.title}</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1.5">
          <span className="text-sm leading-tight">
            {card.price?.previous && <s className="mr-1.5 text-xs text-muted tabular-nums">{card.price.previous}</s>}
            <strong className="text-[var(--accent)]">Grátis</strong>
          </span>
          {ends && (
            <span
              className={[
                'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-bold',
                soon ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-surface-2 text-ink',
              ].join(' ')}
            >
              <Clock className="size-3" aria-hidden />
              {ends}
            </span>
          )}
        </div>
      </div>
    </CardAnchor>
  );
}

export function TicketSkeleton() {
  return <div aria-hidden className="ticket skeleton h-[9.75rem] rounded-md" />;
}
