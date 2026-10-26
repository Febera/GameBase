import type { GameDetails } from '@rj/shared';
import { label } from '../../lib/labels';
import { ReviewBar } from './ReviewBar';

/** Nota de 0–100 na escala de 1 a 10, com uma casa decimal (87 → "8,7"). */
export function toTen(score: number): string {
  return (Math.max(10, score) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Coluna ao lado da mídia: arte, resumo, avaliações e dados principais. */
export function InfoColumn({ game }: { game: GameDetails }) {
  const facts: [string, string][] = [];
  if (game.releaseDate) facts.push(['Lançamento', new Date(`${game.releaseDate}T12:00:00`).toLocaleDateString('pt-BR')]);
  if (game.developers.length) facts.push(['Desenvolvimento', game.developers.join(', ')]);
  if (game.publishers.length) facts.push(['Publicação', game.publishers.join(', ')]);

  return (
    <div className="space-y-5 rounded-xl border border-line bg-surface p-4">
      {game.heroImage ? (
        <img src={game.heroImage} alt="" className="aspect-video w-full rounded-lg object-cover" />
      ) : game.cover ? (
        <img src={game.cover.url} alt="" className="mx-auto aspect-[264/374] w-40 rounded-lg object-cover" />
      ) : null}

      {game.summary && (
        <p lang="en" className="line-clamp-5 text-sm leading-relaxed">
          {game.summary}
        </p>
      )}

      <section aria-label="Avaliações" className="space-y-3">
        {game.steamReviews && <ReviewBar {...game.steamReviews} />}
        {(game.rating !== null || game.criticRating !== null) && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {game.rating !== null && (
              <span>
                Nota IGDB <strong className="text-ink tabular-nums">{toTen(game.rating)}</strong>
                <span className="text-xs">/10</span>
                {game.ratingCount > 0 && <span className="tabular-nums"> ({game.ratingCount})</span>}
              </span>
            )}
            {game.criticRating !== null && (
              <span>
                Crítica <strong className="text-ink tabular-nums">{toTen(game.criticRating)}</strong>
                <span className="text-xs">/10</span>
              </span>
            )}
          </p>
        )}
      </section>

      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-muted">{term}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {game.genres.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Gêneros">
          {game.genres.map((g) => (
            <li key={g} className="rounded-md bg-surface-2 px-2 py-1 text-xs font-semibold">
              {label(g)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
