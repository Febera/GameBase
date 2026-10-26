import { RotateCw } from 'lucide-react';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface px-5 py-6">
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Não foi possível carregar os jogos.</span>{' '}
        <span className="text-muted">{message}</span>
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold hover:brightness-110"
        >
          <RotateCw className="size-4" aria-hidden />
          Tentar de novo
        </button>
      )}
    </div>
  );
}
