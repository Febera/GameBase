import type { SearchResult } from '@rj/shared';
import { Ban, Users } from 'lucide-react';
import { Link } from 'react-router';
import { formatDayMonth, formatMoney } from '../../lib/cards';
import { reviewColor, reviewLabel } from '../gamepage/ReviewBar';
import { DemoTag, playersText } from '../ui/GameTags';

/** Resumo de jogadores; com o filtro de coop ativo, o número de coop vem primeiro. */
export function playersSummary(r: SearchResult, coopFirst = false): string | null {
  return playersText(r.players, coopFirst);
}

/** "2015-11-10" → "10 de novembro de 2015" */
export function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Linha de resultado no estilo da loja: arte larga; título grande e data no alto; avaliação e
 * jogadores na base, alinhados com o preço; à direita, a validade da promoção sobre o preço.
 */
export function ResultRow({ result, coopFirst = false }: { result: SearchResult; coopFirst?: boolean }) {
  const players = playersSummary(result, coopFirst);
  const image = result.artwork ?? result.cover?.url ?? null;
  const reviews = result.steamReviews;
  const onSale = Boolean(result.price && result.price.cut > 0 && !result.free);

  return (
    <Link
      to={`/jogo/${result.id}`}
      className="group grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-md border border-line bg-surface p-2.5 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2 sm:grid-cols-[11rem_minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)_auto] md:items-stretch md:gap-6 md:pr-5"
    >
      <div className="aspect-video self-start overflow-hidden rounded-md bg-surface-2">
        {image && (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>

      {/* Título e data no alto; avaliação e jogadores encostados na base, 6px abaixo da data. */}
      <div className="flex min-w-0 flex-col justify-end gap-1.5 py-0.5">
        <div>
          <p className="mb-3.5 truncate font-display text-2xl font-extrabold leading-tight tracking-tight md:text-[2.125rem]">
            {result.name}
          </p>
          {result.releaseDate && <p className="text-sm text-muted md:text-[0.95rem]">{fullDate(result.releaseDate)}</p>}
        </div>
        <p className="flex min-h-[22px] flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {result.hasDemo && <DemoTag />}
          {reviews && (
            <span className="text-sm font-bold" style={{ color: reviewColor(reviews.percent) }}>
              {reviewLabel(reviews.percent)}
            </span>
          )}
          {players && (
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-sm bg-[var(--accent-new)] px-2 text-xs font-bold text-[var(--on-accent)]">
              <Users className="size-3.5" aria-hidden />
              {players}
            </span>
          )}
        </p>
      </div>

      <div className="col-span-2 flex flex-col items-end justify-end gap-1.5 pb-0.5 md:col-span-1 md:min-w-[14.5rem]">
        {onSale && result.promoEndsAt && (
          <span className="whitespace-nowrap text-[0.8rem] text-muted">Promoção até {formatDayMonth(result.promoEndsAt)}</span>
        )}
        <PriceBlock result={result} />
      </div>
    </Link>
  );
}

/** Mesma altura em todos os casos (52px), para os preços alinharem entre as linhas. */
function PriceBlock({ result }: { result: SearchResult }) {
  const price = result.price;

  if (result.free) {
    return (
      <span className="flex h-[52px] items-center rounded-sm bg-surface-2 px-3.5 text-lg font-bold text-[var(--accent-deal)]">Grátis</span>
    );
  }
  if (!price) {
    return (
      <span className="flex h-[52px] w-[14.5rem] items-center justify-center gap-2 rounded-sm border border-dashed border-line-strong text-[0.95rem] font-semibold text-muted">
        <Ban className="size-4" aria-hidden />
        Preço indisponível
      </span>
    );
  }
  if (price.cut <= 0) {
    return (
      <span className="flex h-[52px] items-center rounded-sm bg-surface-2 px-3.5 text-lg font-bold tabular-nums">
        {formatMoney(price.current)}
      </span>
    );
  }
  return (
    <span className="flex h-[52px] items-stretch overflow-hidden rounded-sm">
      <span className="flex items-center bg-[var(--accent-deal)] px-[7px] font-display text-xl font-extrabold text-[#16210a] tabular-nums">
        −{price.cut}%
      </span>
      <span className="flex flex-col items-end justify-center bg-surface-2 px-3 leading-tight tabular-nums">
        <s className="text-[0.8rem] text-muted">{formatMoney(price.regular)}</s>
        <span className="text-lg font-bold text-[var(--accent-deal)]">{formatMoney(price.current)}</span>
      </span>
    </span>
  );
}
