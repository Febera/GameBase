import type { SearchFilters, SearchSort } from '@rj/shared';
import { LayoutGrid, List } from 'lucide-react';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { Card, CardSkeleton } from '../components/game/Card';
import { SectionArt } from '../components/home/SectionArt';
import { ActiveFilters, chipsOf } from '../components/search/ActiveFilters';
import { EmptyResults } from '../components/search/EmptyResults';
import { FiltersSidebar } from '../components/search/FiltersSidebar';
import { type GroupPick, ResultRow } from '../components/search/ResultRow';
import { ErrorState } from '../components/ui/ErrorState';
import { SlowServerNote } from '../components/ui/SlowServerNote';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useBoard } from '../hooks/useRecommendations';
import { useFacets, useSearchResults } from '../hooks/useSearch';
import { useSlowLoading } from '../hooks/useSlowLoading';
import { gameToCard } from '../lib/cards';
import { ALL_PRICES, parseSearch, type ResultsView, toSearchParams } from '../lib/searchParams';

/** Até quantos filtros entram no título; o resto vira "+N". */
const TITLE_FILTERS = 3;

const SORT_TABS: { value: SearchSort; text: string; needsQuery?: boolean }[] = [
  { value: 'relevance', text: 'Relevância', needsQuery: true },
  { value: 'popular', text: 'Mais populares' },
  { value: 'rating', text: 'Mais bem avaliados' },
  { value: 'recent', text: 'Lançamentos' },
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { filters, view } = parseSearch(params);
  const facets = useFacets().data;
  const results = useSearchResults(filters);
  const { data, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = results;
  const slow = useSlowLoading(isPending);

  const update = useCallback(
    (patch: Partial<SearchFilters>, nextView: ResultsView = view) => {
      const next = { ...filters, ...patch };
      // Marcar todas as opções de uma categoria é o mesmo que não marcar nenhuma.
      const full = (list: unknown[] | undefined, total: number | undefined) =>
        Boolean(total && list && list.length >= total);
      if (full(next.prices, ALL_PRICES.length)) next.prices = [];
      if (full(next.stores, facets?.stores.length)) next.stores = [];
      if (full(next.genres, facets?.genres.length)) next.genres = [];
      setParams(toSearchParams(next, nextView), { replace: true });
    },
    [filters, view, setParams, facets],
  );

  const sentinel = useInfiniteScroll(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, Boolean(hasNextPage) && !isError);

  useEffect(() => {
    document.title = filters.q ? `${filters.q} · busca · GameBase` : 'Busca · GameBase';
  }, [filters.q]);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const first = data?.pages[0];
  const activeSort: SearchSort = filters.sort ?? (filters.q ? 'relevance' : 'popular');
  const pending = first?.pending ?? 0;

  // Jogos do placar do grupo: selo dourado com os apoios.
  const board = useBoard().data;
  const groupById = useMemo(() => {
    const map = new Map<number, GroupPick>();
    board?.entries.forEach((e, i) => map.set(e.game.id, { rank: i + 1, upvotes: e.upvotes }));
    return map;
  }, [board]);

  // Título que diz o que está sendo buscado: o texto, ou os filtros ativos.
  const chips = chipsOf(filters, facets);
  const title = filters.q
    ? `Resultados para “${filters.q}”`
    : chips.length
      ? chips
          .slice(0, TITLE_FILTERS)
          .map((c, i) => (i === 0 ? c.text.charAt(0).toUpperCase() + c.text.slice(1) : c.text))
          .join(' · ') + (chips.length > TITLE_FILTERS ? ` · +${chips.length - TITLE_FILTERS}` : '')
      : 'Explorar jogos';
  const totalText = first
    ? first.total === 0
      ? 'Nenhum jogo encontrado'
      : `${first.total}${first.total >= 500 ? '+' : ''} ${first.total === 1 ? 'jogo' : 'jogos'}`
    : null;
  const sortText = SORT_TABS.find((t) => t.value === activeSort)?.text.toLowerCase();

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]" style={{ '--accent': 'var(--accent-new)' } as CSSProperties}>
      <FiltersSidebar
        filters={filters}
        facets={facets}
        onChange={(patch) => update(patch)}
        onClear={() => setParams(toSearchParams({ q: filters.q, sort: filters.sort }, view), { replace: true })}
        initiallyOpen={Boolean((location.state as { openFilters?: boolean } | null)?.openFilters)}
      />

      <div className="min-w-0 space-y-4">
        <header className="relative isolate space-y-3 pb-1 pt-2">
          <SectionArt kind="search" className="-top-24 h-[calc(100%+9rem)]" />
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight [text-wrap:balance] md:text-4xl">{title}</h1>
            {totalText && (
              <p className="mt-1 text-muted">
                {totalText}
                {first && first.total > 0 && sortText && <span> · {sortText}</span>}
              </p>
            )}
          </div>
          <ActiveFilters filters={filters} facets={facets} onChange={(patch) => update(patch)} />
        </header>

        {/* Ordenação e visualização ficam presas no topo ao rolar, logo abaixo da barra do site. */}
        <div className="sticky-under-topbar sticky z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-1.5 shadow-[0_10px_24px_-18px_rgb(0_0_0/0.8)] backdrop-blur-md">
          <div role="tablist" aria-label="Ordenar por" className="flex flex-wrap gap-1">
            {SORT_TABS.filter((t) => !t.needsQuery || filters.q).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeSort === tab.value}
                onClick={() => update({ sort: tab.value })}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  activeSort === tab.value ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
                ].join(' ')}
              >
                {tab.text}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Visualização">
            {first && first.total > 0 && (
              <span className="mr-2 hidden text-sm font-semibold tabular-nums text-muted sm:inline">{totalText}</span>
            )}
            <ViewButton active={view === 'list'} onClick={() => update({}, 'list')} label="Lista">
              <List className="size-5" aria-hidden />
            </ViewButton>
            <ViewButton active={view === 'grid'} onClick={() => update({}, 'grid')} label="Grade de capas">
              <LayoutGrid className="size-5" aria-hidden />
            </ViewButton>
          </div>
        </div>

        {pending > 0 && (
          <p role="status" className="text-sm text-muted">
            Verificando {pending} {pending === 1 ? 'jogo' : 'jogos'} na Steam{' '}
            {filters.sort === 'rating' && !filters.prices?.length ? 'para ordenar pelas avaliações' : 'para o filtro de preço'}. Os
            resultados se atualizam sozinhos.
          </p>
        )}

        {isError && items.length === 0 ? (
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        ) : !isPending && items.length === 0 ? (
          <EmptyResults filters={filters} facets={facets} onChange={(patch) => update(patch)} />
        ) : view === 'list' ? (
          <ul className="space-y-2.5">
            {items.map((r, i) => (
              <li key={r.id}>
                <ResultRow
                  result={r}
                  coopFirst={filters.mode === 'coop'}
                  rank={activeSort === 'rating' ? i + 1 : undefined}
                  group={groupById.get(r.id)}
                />
              </li>
            ))}
            {(isPending || isFetchingNextPage) &&
              Array.from({ length: isPending ? 6 : 3 }, (_, i) => (
                <li key={`sk-${i}`} aria-hidden className="h-[6.5rem] skeleton rounded-xl  md:h-[8.4rem]" />
              ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {items.map((r) => (
              <li key={r.id}>
                <Card card={gameToCard(r)} groupVotes={groupById.get(r.id)?.upvotes} />
              </li>
            ))}
            {(isPending || isFetchingNextPage) &&
              Array.from({ length: isPending ? 10 : 5 }, (_, i) => (
                <li key={`sk-${i}`}>
                  <CardSkeleton />
                </li>
              ))}
          </ul>
        )}

        {slow && <SlowServerNote />}
        <div ref={sentinel} aria-hidden className="h-px" />
        {!hasNextPage && items.length > 0 && (
          <p className="pt-4 text-center text-sm text-muted">
            {first && first.total >= 500 ? 'Fim dos 500 resultados mais relevantes. Refine os filtros para ver outros.' : 'Fim da lista.'}
          </p>
        )}
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={[
        'flex size-9 items-center justify-center rounded-lg transition-colors',
        active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
