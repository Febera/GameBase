import type { GameDetails } from '@rj/shared';

export function About({ game }: { game: GameDetails }) {
  if (!game.summary && !game.storyline) return null;
  return (
    <section aria-labelledby="sobre" className="space-y-3">
      <h2 id="sobre" className="font-display text-2xl font-bold tracking-tight">
        Sobre
      </h2>
      {game.summary && (
        <p lang="en" className="max-w-prose leading-relaxed">
          {game.summary}
        </p>
      )}
      {game.storyline && (
        <details className="max-w-prose">
          <summary className="cursor-pointer font-semibold text-muted hover:text-ink">História</summary>
          <p lang="en" className="mt-2 leading-relaxed">
            {game.storyline}
          </p>
        </details>
      )}
      <p className="text-xs text-muted">Descrição em inglês, como vem da IGDB.</p>
    </section>
  );
}
