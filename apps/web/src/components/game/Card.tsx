import type { PointerEvent } from 'react';
import { Link } from 'react-router';
import type { CardModel } from '../../lib/cards';

interface Props {
  card: CardModel;
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

/**
 * Card de jogo: capa com o nome no canto inferior direito.
 * Ofertas e giveaways acrescentam uma etiqueta (desconto, prazo) e preço/loja sob o nome.
 * A cor da etiqueta vem da variável --accent da seção.
 */
export function Card({ card }: Props) {
  const className = 'card-link group block rounded-md';
  const content = <CardContent card={card} />;
  const handlers = { onPointerMove: onMove, onPointerLeave: onLeave };

  return card.external ? (
    <a
      href={card.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${card.label} (abre em nova aba)`}
      className={className}
      {...handlers}
    >
      {content}
    </a>
  ) : (
    <Link to={card.href} aria-label={card.label} className={className} {...handlers}>
      {content}
    </Link>
  );
}

function CardContent({ card }: Props) {
  const hasDetails = Boolean(card.price || card.note);
  const image = card.cover ?? (card.fallbackImage ? { url: card.fallbackImage, url2x: card.fallbackImage } : null);
  return (
    <div className="card-tilt relative aspect-[264/374] overflow-hidden rounded-md bg-surface-2 ring-1 ring-line">
      {image ? (
        <img
          src={image.url}
          srcSet={image.url2x !== image.url ? `${image.url} 1x, ${image.url2x} 2x` : undefined}
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

      <div className="absolute inset-x-3 bottom-2.5 text-right text-white">
        <span className="line-clamp-2 font-display text-[0.95rem] font-semibold leading-tight">{card.title}</span>
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

export function CardSkeleton() {
  return <div aria-hidden className="skeleton aspect-[264/374] rounded-md" />;
}
