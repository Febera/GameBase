/** Resumo das avaliações dos jogadores, no estilo de barra positivo/negativo. */
/** Cor do texto da avaliação: positivas, mistas ou negativas. */
export function reviewColor(percent: number): string {
  if (percent >= 70) return 'var(--review-pos)';
  if (percent >= 40) return 'var(--review-mid)';
  return 'var(--review-neg)';
}

/** Parte positiva da barra: verde, ou amarela quando as avaliações são mistas. */
export function reviewBarColor(percent: number): string {
  return percent >= 40 && percent < 70 ? 'var(--review-mid)' : 'var(--review-pos)';
}

export function reviewLabel(percent: number): string {
  if (percent >= 95) return 'Extremamente positivas';
  if (percent >= 80) return 'Muito positivas';
  if (percent >= 70) return 'Positivas';
  if (percent >= 40) return 'Mistas';
  return 'Negativas';
}

export function ReviewBar({ percent, count, url }: { percent: number; count: number; url: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
          style={{ color: reviewColor(percent) }}
        >
          {reviewLabel(percent)}
        </a>
        <span className="text-muted tabular-nums">{count.toLocaleString('pt-BR')} na Steam</span>
      </div>
      <div
        className="mt-1.5 flex h-1.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${percent}% das avaliações na Steam são positivas`}
      >
        <span style={{ width: `${percent}%`, background: reviewBarColor(percent) }} />
        <span className="flex-1 bg-[var(--review-neg)]" />
      </div>
      <p className="mt-1 text-xs text-muted tabular-nums">{percent}% positivas</p>
    </div>
  );
}
