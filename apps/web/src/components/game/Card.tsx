import type { PointerEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { Trophy } from 'lucide-react';
import { DemoTag } from '../ui/GameTags';
import type { CardModel } from '../../lib/cards';

interface Props {
  card: CardModel;
  featured?: boolean;
  /** Apoios no placar do grupo, quando o jogo está nele (selo dourado). */
  groupVotes?: number;
}

/** Inclinação máxima da capa, em graus, quando o mouse está na borda. */
const TILT = 9;

/** Atualiza a inclinação pela posição do mouse (só mouse; toque não inclina). */
function onMove(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return;
  const tilt = event.currentTarget.querySelector<HTMLElement>('.card-tilt');
  if (!tilt) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  tilt.style.setProperty('--rx', `${((0.5 - y) * TILT).toFixed(2)}deg`);
  tilt.style.setProperty('--ry', `${((x - 0.5) * TILT).toFixed(2)}deg`);
}

function onLeave(event: PointerEvent<HTMLElement>) {
  const tilt = event.currentTarget.querySelector<HTMLElement>('.card-tilt');
  tilt?.style.setProperty('--rx', '0deg');
  tilt?.style.setProperty('--ry', '0deg');
}

/** Link de um card: página do GameBase, ou nova aba quando o destino é fora do site. */
export function CardAnchor({
  card,
  className,
  children,
  tilt = false,
}: {
  card: CardModel;
  className: string;
  children: ReactNode;
  /** Liga a inclinação da capa pela posição do mouse. */
  tilt?: boolean;
}) {
  const handlers = tilt ? { onPointerMove: onMove, onPointerLeave: onLeave } : {};
  return card.external ? (
    <a
      href={card.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${card.label} (abre em nova aba)`}
      className={className}
      {...handlers}
    >
      {children}
    </a>
  ) : (
    <Link to={card.href} aria-label={card.label} className={className} {...handlers}>
      {children}
    </Link>
  );
}

/**
 * Card de jogo: capa com o nome no canto inferior direito.
 * Ofertas e giveaways acrescentam uma etiqueta (desconto, prazo) e preço/loja sob o nome.
 * A cor da etiqueta vem da variável --accent da seção.
 * Com `featured`, o card ocupa a altura da célula (grade com o primeiro jogo em 2 × 2).
 */
export function Card({ card, featured = false, groupVotes }: Props) {
  return (
    <CardAnchor card={card} tilt className={`card-link group block rounded-md ${featured ? 'md:h-full' : ''}`}>
      <CardContent card={card} featured={featured} groupVotes={groupVotes} />
    </CardAnchor>
  );
}

function CardContent({ card, featured = false, groupVotes }: Props) {
  const hasDetails = Boolean(card.price || card.note);
  const image = card.cover ?? (card.fallbackImage ? { url: card.fallbackImage, url2x: card.fallbackImage } : null);
  return (
    <div
      className={[
        'card-tilt relative aspect-[264/374] overflow-hidden rounded-md bg-surface-2 ring-1 ring-line',
        featured ? 'md:aspect-auto md:h-full' : '',
      ].join(' ')}
    >
      {image ? (
        <img
          // No destaque a capa fica com o dobro do tamanho: já começa na versão grande.
          src={featured ? image.url2x : image.url}
          srcSet={!featured && image.url2x !== image.url ? `${image.url} 1x, ${image.url2x} 2x` : undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className="card-cover size-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="size-full bg-[linear-gradient(150deg,var(--brand-a),var(--brand-b)_55%,var(--brand-c))] opacity-60"
        />
      )}

      <div
        aria-hidden
        className={[
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim via-scrim/60 to-transparent',
          hasDetails ? 'h-3/4' : 'h-3/5',
        ].join(' ')}
      />
      <div aria-hidden className="card-glass pointer-events-none absolute inset-0" />
      <div aria-hidden className="card-glass-edge pointer-events-none absolute inset-0 rounded-md" />

      {card.badge && (
        <span className="absolute left-2.5 top-2.5 rounded-sm bg-[var(--accent)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--on-accent)] shadow-sm">
          {card.badge}
        </span>
      )}

      {groupVotes !== undefined && (
        <span
          className={`absolute left-2.5 ${card.badge ? 'top-9' : 'top-2.5'} inline-flex items-center gap-1 rounded-sm bg-[linear-gradient(120deg,#fff1c2,#f3d27a_45%,#c48a1d)] px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#2a1d02] shadow-sm`}
          title="Recomendado pelo grupo"
        >
          <Trophy className="size-3" aria-hidden />
          {groupVotes}
          <span className="sr-only"> apoios no placar do grupo</span>
        </span>
      )}

      {card.demo && (
        <span className="absolute right-2.5 top-2.5 shadow-sm">
          <DemoTag />
        </span>
      )}

      <div className="absolute inset-x-3 bottom-2.5 text-right text-white">
        <span
          className={`line-clamp-2 font-display font-semibold leading-tight ${featured ? 'text-[0.95rem] md:text-2xl md:font-bold' : 'text-[0.95rem]'}`}
        >
          {card.title}
        </span>
        {card.price && (
          <p className="mt-1 text-sm leading-tight">
            {card.price.previous && <s className="mr-1.5 text-xs text-white/60 tabular-nums">{card.price.previous}</s>}
            <span className="font-semibold tabular-nums">{card.price.current}</span>
          </p>
        )}
        {card.note && <p className="mt-0.5 truncate text-xs text-white/70">{card.note}</p>}
      </div>
    </div>
  );
}

export function CardSkeleton({ featured = false }: { featured?: boolean }) {
  return <div aria-hidden className={`skeleton aspect-[264/374] rounded-md ${featured ? 'md:aspect-auto md:h-full' : ''}`} />;
}
