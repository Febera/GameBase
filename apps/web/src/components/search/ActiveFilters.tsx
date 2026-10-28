import type { SearchFacets, SearchFilters } from '@rj/shared';
import { X } from 'lucide-react';
import { label } from '../../lib/labels';

export interface Chip {
  key: string;
  text: string;
  remove: Partial<SearchFilters>;
}

/** Filtros ativos em texto, cada um com o que remover para desfazê-lo. */
export function chipsOf(f: SearchFilters, facets: SearchFacets | undefined): Chip[] {
  const chips: Chip[] = [];
  if (f.players) {
    const kind = f.mode === 'coop' ? 'coop online' : 'online';
    chips.push({
      key: 'players',
      text: `${f.players}+ jogadores ${kind}${f.unknownPlayers ? ' (ou sem informação)' : ''}`,
      remove: { players: undefined, unknownPlayers: undefined },
    });
  } else if (f.mode === 'coop') {
    chips.push({ key: 'mode', text: 'Cooperativo', remove: { mode: undefined } });
  }
  const priceNames = { free: 'Grátis', demo: 'Pago com demo', paid: 'Pago sem demo' } as const;
  for (const p of f.prices ?? []) {
    chips.push({ key: `price-${p}`, text: priceNames[p], remove: { prices: f.prices!.filter((x) => x !== p) } });
  }
  for (const key of f.stores ?? []) {
    const name = facets?.stores.find((s) => s.key === key)?.name ?? key;
    chips.push({ key: `store-${key}`, text: name, remove: { stores: f.stores!.filter((s) => s !== key) } });
  }
  for (const id of f.genres ?? []) {
    const name = facets?.genres.find((g) => g.id === id)?.name;
    chips.push({ key: `genre-${id}`, text: name ? label(name) : `Gênero ${id}`, remove: { genres: f.genres!.filter((g) => g !== id) } });
  }
  if (f.yearMin || f.yearMax) {
    const text = f.yearMin && f.yearMax ? `${f.yearMin}–${f.yearMax}` : f.yearMin ? `Desde ${f.yearMin}` : `Até ${f.yearMax}`;
    chips.push({ key: 'years', text, remove: { yearMin: undefined, yearMax: undefined } });
  }
  if (f.ratingMin) chips.push({ key: 'rating', text: `Nota ${f.ratingMin / 10}+`, remove: { ratingMin: undefined } });
  if (f.showDuplicates) chips.push({ key: 'dups', text: 'Com duplicatas', remove: { showDuplicates: undefined } });
  return chips;
}

/** Filtros ativos como chips removíveis, acima dos resultados. */
export function ActiveFilters({
  filters,
  facets,
  onChange,
}: {
  filters: SearchFilters;
  facets: SearchFacets | undefined;
  onChange: (patch: Partial<SearchFilters>) => void;
}) {
  const chips = chipsOf(filters, facets);
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onChange(chip.remove)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] py-1 pl-3 pr-2 text-sm font-semibold backdrop-blur transition-colors hover:border-brand-b"
          >
            {chip.text}
            <X className="size-3.5 text-muted" aria-hidden />
            <span className="sr-only">(remover filtro)</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
