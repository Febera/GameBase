import type { GameDetails } from '@rj/shared';
import { Columns2, Globe, Handshake, type LucideIcon, Monitor, Sofa, User, Users } from 'lucide-react';

interface Item {
  icon: LucideIcon;
  text: string;
  /** Números de jogadores ganham destaque: é o que o grupo procura. */
  highlight?: boolean;
}

function itemsOf(game: GameDetails): Item[] {
  const p = game.players;
  const modes = new Set(game.modes);
  const items: Item[] = [];
  if (modes.has('Single player')) items.push({ icon: User, text: 'Um jogador' });
  if (p?.onlineMax) items.push({ icon: Globe, text: `Até ${p.onlineMax} jogadores online`, highlight: true });
  if (p?.onlineCoopMax) items.push({ icon: Handshake, text: `Coop online até ${p.onlineCoopMax}`, highlight: true });
  if (p?.offlineMax) items.push({ icon: Monitor, text: `Até ${p.offlineMax} no mesmo PC`, highlight: true });
  if (p?.offlineCoopMax) items.push({ icon: Sofa, text: `Coop local até ${p.offlineCoopMax}`, highlight: true });
  if (modes.has('Split screen')) items.push({ icon: Columns2, text: 'Tela dividida' });
  if (!p?.onlineMax && !p?.offlineMax && modes.has('Multiplayer')) {
    items.push({ icon: Users, text: 'Multijogador (sem número de jogadores na IGDB)' });
  }
  if (!p?.onlineCoopMax && !p?.offlineCoopMax && modes.has('Co-operative')) {
    items.push({ icon: Handshake, text: 'Cooperativo (sem número de jogadores na IGDB)' });
  }
  return items;
}

/** Painel lateral com o que mais importa para o grupo: quantos jogam juntos e como. */
export function PlayTogether({ game }: { game: GameDetails }) {
  const items = itemsOf(game);
  return (
    <section aria-labelledby="jogar-junto" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="jogar-junto" className="mb-3 font-display text-lg font-bold tracking-tight">
        Para jogar junto
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">A IGDB não tem informação de modos de jogo para este jogo.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.text}
              className={[
                'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm',
                item.highlight ? 'bg-surface-2 font-semibold' : 'text-muted',
              ].join(' ')}
            >
              <span
                className={[
                  'flex size-7 shrink-0 items-center justify-center rounded-md',
                  item.highlight ? 'bg-[var(--accent-new)] text-[var(--on-accent)]' : 'bg-surface-2',
                ].join(' ')}
              >
                <item.icon className="size-4" aria-hidden />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
