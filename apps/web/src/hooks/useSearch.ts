import type { SearchFilters } from '@rj/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { usePreferences } from '../app/preferences';
import { api } from '../lib/apiClient';
import { toApiParams } from '../lib/searchParams';

const PAGE = 20;

export function useSearchResults(filters: SearchFilters) {
  const { adultMode } = usePreferences();
  return useInfiniteQuery({
    queryKey: ['search', toApiParams(filters), adultMode],
    queryFn: ({ pageParam }) => api.search(filters, pageParam, PAGE, adultMode),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    // Enquanto o servidor verifica grátis/demo na Steam, atualiza a cada 30 s.
    refetchInterval: (query) => ((query.state.data?.pages[0]?.pending ?? 0) > 0 ? 30_000 : false),
  });
}

export function useFacets() {
  return useQuery({ queryKey: ['facets'], queryFn: api.facets, staleTime: 60 * 60 * 1000 });
}

/** Valor que só muda depois de `ms` sem alterações (para o autocomplete). */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function useSuggestions(q: string, enabled: boolean) {
  const { adultMode } = usePreferences();
  const text = q.trim();
  return useQuery({
    queryKey: ['suggest', text.toLowerCase(), adultMode],
    queryFn: () => api.suggest(text, adultMode),
    enabled: enabled && text.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}
