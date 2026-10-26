import type { GameDetails } from '@rj/shared';
import { label } from '../../lib/labels';

/** Ficha técnica: classificações que não aparecem no topo. */
export function Details({ game }: { game: GameDetails }) {
  const rows: [string, string][] = [];
  if (game.modes.length) rows.push(['Modos', game.modes.map(label).join(', ')]);
  if (game.perspectives.length) rows.push(['Perspectiva', game.perspectives.map(label).join(', ')]);
  if (game.themes.length) rows.push(['Temas', game.themes.map(label).join(', ')]);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="ficha" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="ficha" className="mb-3 font-display text-lg font-bold tracking-tight">
        Ficha
      </h2>
      <dl className="space-y-3 text-sm">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt className="text-muted">{term}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
