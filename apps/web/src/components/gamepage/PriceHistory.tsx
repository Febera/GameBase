import type { GameDetails, PriceLow } from '@rj/shared';
import { History, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatMoney } from '../../lib/cards';

export type PricingData = Pick<
  GameDetails,
  'name' | 'offers' | 'steam' | 'storeLinks' | 'historyLow' | 'yearLow' | 'giveaway'
>;

/** Menor preço disponível agora (entre as lojas, ou o da Steam). */
export function currentBestPrice(data: PricingData): number | null {
  return data.offers[0]?.price.amount ?? data.steam?.price?.current.amount ?? null;
}

/** O preço de agora é o menor já registrado? (tolerância de meio centavo) */
export function isAtHistoricalLow(data: PricingData): boolean {
  const now = currentBestPrice(data);
  const low = data.historyLow?.price.amount;
  return now !== null && low !== undefined && now > 0 && now <= low + 0.005;
}

/** Posições, tamanhos e atrasos das faíscas: fixos, para não "pular" a cada render. */
const SPARKLES = [
  { left: '6%', top: '18%', size: 14, delay: '0s' },
  { left: '22%', top: '62%', size: 10, delay: '0.6s' },
  { left: '41%', top: '12%', size: 12, delay: '1.2s' },
  { left: '58%', top: '58%', size: 9, delay: '0.3s' },
  { left: '74%', top: '20%', size: 13, delay: '0.9s' },
  { left: '90%', top: '55%', size: 10, delay: '1.5s' },
];

/**
 * Histórico de preços como uma "aba" atrás do bloco de compra: menor, mais discreta e encaixada
 * nele. Quando o preço de agora é o menor da história, vira dourada, com brilho e faíscas.
 */
export function PriceHistory({ data }: { data: PricingData }) {
  if (data.steam?.free || (!data.historyLow && !data.yearLow)) return null;
  const gold = isAtHistoricalLow(data);

  return (
    <aside
      aria-label="Histórico de preços"
      className={[
        'relative z-0 mx-3 -mb-1.5 overflow-hidden rounded-t-md border border-b-0 px-4 pb-4 pt-3 sm:mx-5',
        // Painel escuro nos dois temas, para o texto branco sempre ter contraste.
        gold ? 'gold-panel border-[#f3d27a]/50' : 'border-white/10 bg-[#262626] text-white',
      ].join(' ')}
    >
      {gold &&
        SPARKLES.map((s) => (
          <Sparkles
            key={`${s.left}-${s.top}`}
            aria-hidden
            className="sparkle"
            style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay } as CSSProperties}
          />
        ))}

      <p
        className={`relative mb-2 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-wider ${gold ? '' : 'text-white/75'}`}
      >
        {gold ? <Sparkles className="size-3.5" aria-hidden /> : <History className="size-3.5" aria-hidden />}
        {gold ? 'Menor preço da história, agora' : 'Histórico de preços'}
      </p>

      <dl className="relative grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {data.yearLow && <LowItem title="Menor em 12 meses" low={data.yearLow} gold={gold} />}
        {data.historyLow && <LowItem title="Menor de todos os tempos" low={data.historyLow} gold={gold} />}
      </dl>
    </aside>
  );
}

function LowItem({ title, low, gold }: { title: string; low: PriceLow; gold: boolean }) {
  const date = low.date ? new Date(`${low.date}T12:00:00`).toLocaleDateString('pt-BR') : null;
  return (
    <div>
      <dt className={gold ? 'opacity-80' : 'text-white/75'}>{title}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <strong className="font-display text-base tabular-nums">{formatMoney(low.price)}</strong>
        {(low.shop || date) && (
          <span className={`text-xs ${gold ? 'opacity-80' : 'text-white/75'}`}>
            {[low.shop && `na ${low.shop}`, date && `em ${date}`].filter(Boolean).join(' ')}
          </span>
        )}
      </dd>
    </div>
  );
}
