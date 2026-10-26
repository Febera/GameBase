import type { RecommendationEntry } from '@rj/shared';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useRecommendationActions } from '../../hooks/useRecommendations';

interface Props {
  entry: RecommendationEntry;
  threshold: number;
  compact?: boolean;
}

/** Apoiar e pedir remoção. Um voto de cada por conexão; clicar de novo desfaz. */
export function VoteButtons({ entry, threshold, compact = false }: Props) {
  const { vote } = useRecommendationActions();
  const id = entry.game.id;
  const busy = vote.isPending && vote.variables?.id === id;

  const toggleRemove = () => {
    const willRemove = !entry.votedRemove && entry.removeVotes + 1 >= threshold;
    if (willRemove && !window.confirm(`Seu voto vai tirar ${entry.game.name} do placar. Continuar?`)) return;
    vote.mutate({ id, kind: 'remove', on: !entry.votedRemove });
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'flex-wrap'}`}>
      <button
        type="button"
        disabled={busy}
        aria-pressed={entry.votedUp}
        onClick={() => vote.mutate({ id, kind: 'up', on: !entry.votedUp })}
        title={entry.votedUp ? 'Tirar meu apoio' : 'Apoiar'}
        className={[
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums transition disabled:opacity-60',
          entry.votedUp ? 'bg-[var(--accent-new)] text-[var(--on-accent)]' : 'bg-surface-2 text-ink hover:brightness-110',
        ].join(' ')}
      >
        <ThumbsUp className={`size-4 ${entry.votedUp ? 'fill-current' : ''}`} aria-hidden />
        {entry.upvotes}
        <span className="sr-only">{entry.votedUp ? 'apoios, você apoiou (clique para desfazer)' : 'apoios, clique para apoiar'}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        aria-pressed={entry.votedRemove}
        onClick={toggleRemove}
        title={entry.votedRemove ? 'Cancelar meu pedido de remoção' : `Pedir remoção (${threshold} pedidos tiram do placar)`}
        className={[
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums transition disabled:opacity-60',
          entry.votedRemove ? 'bg-[var(--accent-paid)] text-[var(--on-accent)]' : 'text-muted hover:bg-surface-2 hover:text-ink',
        ].join(' ')}
      >
        <ThumbsDown className={`size-3.5 ${entry.votedRemove ? 'fill-current' : ''}`} aria-hidden />
        {compact ? `${entry.removeVotes}/${threshold}` : `Remover ${entry.removeVotes}/${threshold}`}
      </button>
    </div>
  );
}
