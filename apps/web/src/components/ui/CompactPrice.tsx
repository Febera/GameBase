import type { GameCard } from '@rj/shared';
import { formatMoney } from '../../lib/cards';

/** Preço numa linha: promoção (etiqueta, antigo riscado, novo em verde), cheio, grátis ou indisponível. */
export function CompactPrice({ game }: { game: GameCard }) {
  if (game.free) return <span className="text-base font-bold text-[var(--accent-deal)]">Grátis</span>;
  const price = game.price;
  if (!price) return <span className="text-[0.8rem] font-semibold text-muted">Preço indisponível</span>;
  if (price.cut <= 0) return <span className="text-base font-bold tabular-nums">{formatMoney(price.current)}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 tabular-nums">
      <span className="rounded-sm bg-[var(--accent-deal)] px-1.5 py-0.5 text-[0.8rem] font-extrabold text-[#16210a]">−{price.cut}%</span>
      <s className="text-xs text-muted">{formatMoney(price.regular)}</s>
      <span className="text-base font-bold text-[var(--accent-deal)]">{formatMoney(price.current)}</span>
    </span>
  );
}
