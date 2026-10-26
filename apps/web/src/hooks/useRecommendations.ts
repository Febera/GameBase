import type { VoteKind } from '@rj/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { subscribeToRecommendations } from '../lib/liveRecommendations';
import { usePreferences } from '../app/preferences';
import { api } from '../lib/apiClient';

/** Recarrega placar e status assim que alguém (de qualquer lugar) recomenda ou vota. */
function useLiveUpdates() {
  const client = useQueryClient();
  useEffect(
    () =>
      subscribeToRecommendations(() => {
        void client.invalidateQueries({ queryKey: ['recommendations'] });
      }),
    [client],
  );
}

export function useBoard() {
  const { adultMode } = usePreferences();
  useLiveUpdates();
  return useQuery({
    queryKey: ['recommendations', 'board', adultMode],
    queryFn: () => api.recommendations(adultMode),
    // Reserva, caso a conexão ao vivo não esteja disponível (inclusive com a aba em segundo plano).
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 5_000,
  });
}

export function useRecommendationStatus(id: number) {
  useLiveUpdates();
  return useQuery({
    queryKey: ['recommendations', 'status', id],
    queryFn: () => api.recommendation(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });
}

/** Recomendar e votar; depois, atualiza placar e status do jogo. */
export function useRecommendationActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ['recommendations'] });

  const recommend = useMutation({ mutationFn: (id: number) => api.recommend(id), onSettled: refresh });
  const vote = useMutation({
    mutationFn: ({ id, kind, on }: { id: number; kind: VoteKind; on: boolean }) => api.vote(id, kind, on),
    onSettled: refresh,
  });
  return { recommend, vote };
}
