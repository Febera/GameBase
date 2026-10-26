import { Megaphone, ThumbsUp, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { useRecommendationActions, useRecommendationStatus } from '../../hooks/useRecommendations';
import { ApiError } from '../../lib/apiClient';

/** Na página do jogo: recomendar para o grupo, ou apoiar se já está no placar. */
export function RecommendButton({ gameId }: { gameId: number }) {
  const { data, isPending, error } = useRecommendationStatus(gameId);
  const { recommend, vote } = useRecommendationActions();

  // Sem banco no servidor, o recurso some em vez de mostrar um botão que não funciona.
  if (error instanceof ApiError && error.status === 503) return null;
  if (isPending) return <div aria-hidden className="h-10 w-56 skeleton rounded-lg " />;

  const entry = data?.entry;
  const failure = (recommend.error ?? vote.error) as Error | null;

  if (!entry) {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <button
          type="button"
          onClick={() => recommend.mutate(gameId)}
          disabled={recommend.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(100deg,var(--brand-a),var(--brand-b)_55%,var(--brand-c))] px-4 py-2.5 font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-70"
        >
          <Megaphone className="size-4" aria-hidden />
          {recommend.isPending ? 'Recomendando…' : 'Recomendar para geral'}
        </button>
        {failure && <p className="text-xs text-[var(--accent-paid)]">{failure.message}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={entry.votedUp}
          disabled={vote.isPending}
          onClick={() => vote.mutate({ id: gameId, kind: 'up', on: !entry.votedUp })}
          className={[
            'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition disabled:opacity-70',
            entry.votedUp ? 'bg-[var(--accent-new)] text-[var(--on-accent)]' : 'bg-surface-2 text-ink hover:brightness-110',
          ].join(' ')}
        >
          <ThumbsUp className={`size-4 ${entry.votedUp ? 'fill-current' : ''}`} aria-hidden />
          {entry.votedUp ? 'Você apoia' : 'Apoiar'}
          <span className="tabular-nums opacity-80">· {entry.upvotes}</span>
        </button>
        <Link
          to="/recomendacoes"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
        >
          <Trophy className="size-4" aria-hidden />
          No placar do grupo
        </Link>
      </div>
      {failure && <p className="text-xs text-[var(--accent-paid)]">{failure.message}</p>}
    </div>
  );
}
