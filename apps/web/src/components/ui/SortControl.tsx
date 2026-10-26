import type { ListSort, SortOrder } from '@rj/shared';
import { ArrowDown, ArrowUp, CalendarDays, Coins, type LucideIcon, MessagesSquare, Percent } from 'lucide-react';

const OPTIONS: Record<ListSort, { label: string; icon: LucideIcon }> = {
  reviews: { label: 'Avaliações', icon: MessagesSquare },
  discount: { label: 'Desconto', icon: Percent },
  value: { label: 'Valor original', icon: Coins },
  release: { label: 'Lançamento', icon: CalendarDays },
};

interface Props {
  options: ListSort[];
  sort: ListSort;
  order: SortOrder;
  onChange: (sort: ListSort, order: SortOrder) => void;
}

/**
 * Ordenação compacta: as opções não escolhidas mostram só o ícone; a escolhida, ícone e texto.
 * Clicar na escolhida inverte entre decrescente e crescente.
 */
export function SortControl({ options, sort, order, onChange }: Props) {
  return (
    <div role="group" aria-label="Ordenar" className="flex items-center gap-1 rounded-md border border-line bg-surface p-1">
      {options.map((value) => {
        const { label, icon: Icon } = OPTIONS[value];
        const active = value === sort;
        const Arrow = order === 'desc' ? ArrowDown : ArrowUp;
        const next: SortOrder = active ? (order === 'desc' ? 'asc' : 'desc') : 'desc';
        const directionText = order === 'desc' ? 'decrescente' : 'crescente';
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value, next)}
            title={active ? `${label} (${directionText}). Clique para inverter.` : `Ordenar por ${label.toLowerCase()}`}
            aria-label={active ? `Ordenado por ${label.toLowerCase()}, ${directionText}. Inverter` : `Ordenar por ${label.toLowerCase()}`}
            className={[
              'flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm font-semibold transition-colors duration-150',
              active ? 'bg-brand-b text-white' : 'text-muted hover:bg-surface-2 hover:text-ink',
            ].join(' ')}
          >
            <Icon className="size-4" aria-hidden />
            {active && (
              <>
                <span>{label}</span>
                <Arrow className="size-3.5" aria-hidden />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
