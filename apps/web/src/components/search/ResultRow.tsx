import type { SearchResult } from '@rj/shared';
import { Ban, Trophy, Users } from 'lucide-react';
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

/** "80 mil", "1,2 mi": total de avaliações em formato curto. */
export function compactCount(n: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Lugar do jogo no placar do grupo, quando está nele. */
export interface GroupPick {
  rank: number;
  upvotes: number;
}

/**
 * Linha de resultado no estilo da loja: arte larga; título grande e data no alto; avaliação e
 * jogadores na base, alinhados com o preço; à direita, a validade da promoção sobre o preço.
 * Em "Mais bem avaliados", a posição aparece sobre a arte; jogos do placar ganham o selo dourado.
 */
export function ResultRow({
  result,
  coopFirst = false,
  rank,
  group,
}: {
  result: SearchResult;
  coopFirst?: boolean;
  /** Posição na ordenação por nota (1, 2, 3…). */
  rank?: number;
  group?: GroupPick;
}) {
  const players = playersSummary(result, coopFirst);
  const image = result.artwork ?? result.cover?.url ?? null;
  const reviews = result.steamReviews;
  const onSale = Boolean(result.price && result.price.cut > 0 && !result.free);

  return (
    <Link
      to={`/jogo/${result.id}`}
      className="result-row group grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-md border border-line bg-surface p-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)_auto] md:items-stretch md:gap-6 md:pr-5"
    >
      <div className="result-art relative aspect-video self-start overflow-hidden rounded-md bg-surface-2">
        {image && (
          <img src={image} alt="" loading="lazy" className="result-img size-full object-cover" />
        )}
        <div aria-hidden className="card-glass pointer-events-none absolute inset-0" />
        {rank !== undefined && (
          <span
            className={[
              'absolute left-0 top-0 flex h-8 min-w-8 items-center justify-center rounded-br-md px-2 font-display text-base font-extrabold tabular-nums',
              rank <= 3 ? 'bg-[linear-gradient(120deg,#fff1c2,#f3d27a_45%,#c48a1d)] text-[#2a1d02]' : 'bg-[#181818]/90 text-white',
            ].join(' ')}
          >
            <span className="sr-only">Posição </span>
            {rank}
          </span>
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
          {group && (
            <span
              className="inline-flex h-[22px] items-center gap-1.5 rounded-sm bg-[linear-gradient(120deg,#fff1c2,#f3d27a_45%,#c48a1d)] px-2 text-xs font-bold text-[#2a1d02]"
              title={`${group.rank}º no placar do grupo`}
            >
              <Trophy className="size-3.5" aria-hidden />
              Recomendado pelo grupo · {group.upvotes} {group.upvotes === 1 ? 'apoio' : 'apoios'}
            </span>
          )}
          {reviews && (
            <span className="text-sm">
              <span className="font-bold" style={{ color: reviewColor(reviews.percent) }}>
                {reviewLabel(reviews.percent)}
              </span>
              <span className="text-muted tabular-nums">
                {' '}
                · {reviews.percent}% de {compactCount(reviews.total)}
              </span>
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
