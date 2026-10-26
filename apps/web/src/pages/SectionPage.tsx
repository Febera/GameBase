import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import type { ListSort, SortOrder } from '@rj/shared';
import { useParams, useSearchParams } from 'react-router';
import { SortControl } from '../components/ui/SortControl';
import { GameGrid } from '../components/game/GameGrid';
import { ErrorState } from '../components/ui/ErrorState';
import { PendingNote } from '../components/ui/PendingNote';
import { SlowServerNote } from '../components/ui/SlowServerNote';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useSectionInfinite } from '../hooks/useSectionGames';
import { useSlowLoading } from '../hooks/useSlowLoading';
import { findSection, type SectionDef } from '../lib/sections';
import { NotFoundPage } from './NotFoundPage';

export function SectionPage() {
  const { slug } = useParams();
  const section = findSection(slug);
  if (!section) return <NotFoundPage />;
  // key garante estado novo ao trocar de seção
  return <SectionList key={section.slug} section={section} />;
}

/** Ordem na URL ("?ordem=desconto&dir=asc"), para dar para compartilhar a lista ordenada. */
const SORT_URL: Record<ListSort, string> = { reviews: 'avaliacoes', discount: 'desconto', value: 'valor', release: 'lancamento' };
const SORT_FROM_URL = Object.fromEntries(Object.entries(SORT_URL).map(([k, v]) => [v, k])) as Record<string, ListSort>;

function SectionList({ section }: { section: SectionDef }) {
  const [params, setParams] = useSearchParams();
  const requested = SORT_FROM_URL[params.get('ordem') ?? ''];
  const sort: ListSort = requested && section.sorts.includes(requested) ? requested : section.sorts[0]!;
  const order: SortOrder = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const changeOrder = (nextSort: ListSort, nextOrder: SortOrder) => {
    const next = new URLSearchParams();
    if (nextSort !== section.sorts[0]) next.set('ordem', SORT_URL[nextSort]);
    if (nextOrder === 'asc') next.set('dir', 'asc');
    setParams(next, { replace: true });
  };
  const query = useSectionInfinite(section, { sort, order });
  const { data, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const slow = useSlowLoading(isPending);

  const sentinel = useInfiniteScroll(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, Boolean(hasNextPage) && !isError);

  useEffect(() => {
    document.title = `${section.title} · GameBase`;
  }, [section.title]);

  const cards = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total;

  return (
    <div style={{ '--accent': section.accent } as CSSProperties}>
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <span aria-hidden className="h-10 w-2 rounded-full bg-[var(--accent)]" />
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{section.title}</h1>
          {total !== undefined && (
            <p className="mt-1 text-muted">
              {total} {total === 1 ? 'jogo' : 'jogos'}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <SortControl options={section.sorts} sort={sort} order={order} onChange={changeOrder} />
        </div>
      </header>

      {isError && cards.length === 0 ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : !isPending && cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-5 py-8 text-muted">{section.emptyMessage}</p>
      ) : (
        <>
          <GameGrid cards={cards} loadingCount={isPending ? 12 : isFetchingNextPage ? 6 : 0} />
          {slow && <SlowServerNote />}
          <PendingNote count={data?.pages[0]?.pending ?? 0} />
          {isError && cards.length > 0 && (
            <div className="mt-6">
              <ErrorState message={error.message} onRetry={() => void fetchNextPage()} />
            </div>
          )}
          <div ref={sentinel} aria-hidden className="h-px" />
          {!hasNextPage && !isPending && cards.length > 0 && (
            <p className="mt-10 text-center text-sm text-muted">Fim da lista.</p>
          )}
        </>
      )}
    </div>
  );
}
