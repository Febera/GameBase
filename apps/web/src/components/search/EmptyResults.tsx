import type { SearchFacets, SearchFilters } from '@rj/shared';
import { ArrowRight, SearchX } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../../lib/apiClient';
import { usePreferences } from '../../app/preferences';
import { QUICK_SEARCHES } from '../../lib/quickSearches';
import { toSearchParams } from '../../lib/searchParams';
import { QUICK_ICONS } from '../ui/quickIcons';
import { chipsOf } from './ActiveFilters';

/** Quantos filtros, no máximo, são testados para sugerir qual tirar. */
const MAX_RELAXATIONS = 3;

/**
 * Nenhum resultado: em vez de só "tente remover algum filtro", mostra quantos jogos aparecem
 * tirando cada filtro (até 3), e sem filtros, as buscas rápidas.
 */
export function EmptyResults({
  filters,
  facets,
  onChange,
}: {
  filters: SearchFilters;
  facets: SearchFacets | undefined;
  onChange: (patch: Partial<SearchFilters>) => void;
}) {
  const { adultMode } = usePreferences();
  const chips = chipsOf(filters, facets).slice(0, MAX_RELAXATIONS);
  const counts = useQueries({
    queries: chips.map((chip) => ({
      queryKey: ['search-count', { ...filters, ...chip.remove }, adultMode],
      queryFn: () => api.search({ ...filters, ...chip.remove }, 0, 1, adultMode),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const options = chips
    .map((chip, i) => ({ chip, total: counts[i]?.data?.total, loading: counts[i]?.isPending }))
    .filter((o) => o.loading || (o.total ?? 0) > 0);

  return (
    <div className="rounded-md border border-dashed border-line-strong px-6 py-10 text-center">
      <SearchX className="mx-auto size-8 text-muted" aria-hidden />
      <p className="mt-3 text-lg font-bold">Nenhum jogo com esses filtros</p>

      {options.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-muted">Tirando um filtro, aparecem estes:</p>
          <ul className="mx-auto mt-5 flex max-w-xl flex-col gap-2">
            {options.map(({ chip, total, loading }) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() => onChange(chip.remove)}
                  disabled={loading}
                  className="menu-item flex w-full items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left"
                  data-active={undefined}
                >
                  <span className="min-w-0 flex-1 text-sm">
                    Sem <strong>“{chip.text}”</strong>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-brand-b">
                    {loading ? 'contando…' : `${total}${total! >= 500 ? '+' : ''} ${total === 1 ? 'jogo' : 'jogos'}`}
                  </span>
                  <ArrowRight className="menu-arrow size-4 text-brand-b" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Que tal começar por uma destas?</p>
          <ul className="mx-auto mt-5 grid max-w-2xl gap-2 sm:grid-cols-3">
            {QUICK_SEARCHES.slice(0, 6).map((quick) => {
              const { icon: Icon, color } = QUICK_ICONS[quick.key]!;
              return (
                <li key={quick.key}>
                  <Link
                    to={`/busca?${toSearchParams(quick.filters, 'list').toString()}`}
                    className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:border-brand-b"
                  >
                    <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
                    {quick.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
