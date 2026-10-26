import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePreferences } from '../app/preferences';
import type { ListOrder } from '../lib/apiClient';
import { DEFAULT_ORDER, PAGE_SIZE, PREVIEW_SIZE, type SectionDef } from '../lib/sections';

/** Os primeiros itens de uma seção, para a home (sempre por número de avaliações). */
export function useSectionPreview(section: SectionDef) {
  const { adultMode } = usePreferences();
  return useQuery({
    queryKey: ['section', section.slug, 'preview', adultMode],
    queryFn: () => section.fetchPage(0, PREVIEW_SIZE[section.layout], adultMode, DEFAULT_ORDER),
    // Enquanto o servidor ainda verifica jogos na Steam, atualiza a cada 30 s.
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 30_000 : false),
  });
}

/** Lista completa de uma seção, carregada aos poucos (rolagem infinita). */
export function useSectionInfinite(section: SectionDef, order: ListOrder = DEFAULT_ORDER) {
  const { adultMode } = usePreferences();
  return useInfiniteQuery({
    queryKey: ['section', section.slug, 'all', adultMode, order.sort, order.order],
    queryFn: ({ pageParam }) => section.fetchPage(pageParam, PAGE_SIZE, adultMode, order),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });
}
