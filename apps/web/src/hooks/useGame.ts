import { useQuery } from '@tanstack/react-query';
import { usePreferences } from '../app/preferences';
import { ApiError, api } from '../lib/apiClient';

export function useGame(id: number) {
  const { adultMode } = usePreferences();
  return useQuery({
    queryKey: ['game', id, adultMode],
    queryFn: () => api.game(id, adultMode),
    enabled: Number.isInteger(id) && id > 0,
    // 403 (filtro) e 404 não melhoram tentando de novo.
    retry: (count, error) => !(error instanceof ApiError && [403, 404].includes(error.status)) && count < 1,
  });
}
