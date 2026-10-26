import type { PlayerCounts } from '@rj/shared';
import { Users } from 'lucide-react';

/** Resumo de jogadores; com coopFirst, o número de coop vem primeiro. */
export function playersText(p: PlayerCounts | null, coopFirst = false): string | null {
  if (!p) return null;
  if (coopFirst && p.onlineCoopMax) return `coop online até ${p.onlineCoopMax}`;
  if (p.onlineMax && p.onlineCoopMax) return `até ${p.onlineMax} online · coop ${p.onlineCoopMax}`;
  if (p.onlineMax) return `até ${p.onlineMax} online`;
  if (p.onlineCoopMax) return `coop online até ${p.onlineCoopMax}`;
  if (p.offlineMax) return `até ${p.offlineMax} no mesmo PC`;
  return null;
}

/** Selo de jogadores (ciano), igual ao da busca. */
export function PlayersTag({ players, coopFirst = false }: { players: PlayerCounts | null; coopFirst?: boolean }) {
  const text = playersText(players, coopFirst);
  if (!text) return null;
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-sm bg-[var(--accent-new)] px-2 text-xs font-bold text-[var(--on-accent)]">
      <Users className="size-3.5" aria-hidden />
      {text}
    </span>
  );
}

/** Selo "DEMO" (azul), para jogos pagos com demo grátis. Mesma altura do selo de jogadores. */
export function DemoTag() {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center rounded-sm bg-brand-b px-2 text-xs font-extrabold tracking-wider text-[#06202b]">
      DEMO
    </span>
  );
}

/** Ponto separador entre as tags. */
export function TagDot() {
  return <span aria-hidden className="size-1 shrink-0 rounded-full bg-[var(--muted)]" />;
}
