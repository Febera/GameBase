import type { RecommendationEntry } from '@rj/shared';
import { EyeOff, Megaphone } from 'lucide-react';
import { type CSSProperties, useEffect } from 'react';
import { Link } from 'react-router';
import { GoldBackdrop } from '../components/recommendations/GoldBackdrop';
import { VoteButtons } from '../components/recommendations/VoteButtons';
import { CompactPrice } from '../components/ui/CompactPrice';
import { ErrorState } from '../components/ui/ErrorState';
import { DemoTag, PlayersTag, playersText, TagDot } from '../components/ui/GameTags';
import { SlowServerNote } from '../components/ui/SlowServerNote';
import { useBoard } from '../hooks/useRecommendations';
import { useSlowLoading } from '../hooks/useSlowLoading';

const TOP = 5;
/** Altura de cada degrau no desktop: o 1º é o mais alto, descendo 40px por posição. */
const STEP_HEIGHT = ['lg:h-[300px]', 'lg:h-[260px]', 'lg:h-[220px]', 'lg:h-[180px]', 'lg:h-[140px]'];

export function RecommendationsPage() {
  const { data, isPending, isError, error, refetch } = useBoard();
  const slow = useSlowLoading(isPending);

  useEffect(() => {
    document.title = 'Recomendações · GameBase';
  }, []);

  const entries = data?.entries ?? [];
  const top = entries.slice(0, TOP);
  const rest = entries.slice(TOP);
  const threshold = data?.removeThreshold ?? 5;

  return (
    <div className="relative space-y-10" style={{ '--accent': 'var(--accent-new)' } as CSSProperties}>
      <GoldBackdrop />

      <h1 className="font-display text-4xl font-extrabold tracking-tight text-white [text-shadow:0_2px_12px_rgb(60_38_0/0.55),0_1px_2px_rgb(60_38_0/0.6)] md:text-[2.75rem]">
        Recomendações do grupo
      </h1>

      {isError ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : isPending ? (
        <>
          <ul className="grid grid-cols-2 items-end gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: TOP }, (_, i) => (
              <li key={i} className="skeleton aspect-[264/374] rounded-md" />
            ))}
          </ul>
          {slow && <SlowServerNote />}
        </>
      ) : entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-bg/80 px-6 py-14 text-center backdrop-blur">
          <Megaphone className="mx-auto size-9 text-muted" aria-hidden />
          <p className="mt-3 font-display text-xl font-bold">Ninguém recomendou nada ainda</p>
          <p className="mx-auto mt-1 max-w-md text-muted">
            Abra a página de um jogo e clique em “Recomendar para geral” para ele aparecer aqui.
          </p>
          <Link to="/busca" className="mt-5 inline-block rounded-md bg-brand-b px-4 py-2 font-semibold text-[#06202b] hover:brightness-110">
            Explorar jogos
          </Link>
        </div>
      ) : (
        <>
          {/* Pódio em escada: o 1º à esquerda, no degrau mais alto. */}
          <ol aria-label={`Top ${top.length}`} className="grid grid-cols-2 items-end gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {top.map((entry, i) => (
              <PodiumStep key={entry.game.id} entry={entry} rank={i + 1} threshold={threshold} />
            ))}
          </ol>

          {rest.length > 0 && (
            <section aria-labelledby="demais">
              <h2 id="demais" className="mb-3 font-display text-xl font-bold tracking-tight">
                Também recomendados
              </h2>
              <ol start={TOP + 1} className="space-y-2">
                {rest.map((entry, i) => (
                  <RestRow key={entry.game.id} entry={entry} rank={TOP + i + 1} threshold={threshold} index={i} />
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {data && data.hidden > 0 && (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <EyeOff className="size-4" aria-hidden />
          {data.hidden} {data.hidden === 1 ? 'recomendação oculta' : 'recomendações ocultas'} pelo filtro de conteúdo.
        </p>
      )}
    </div>
  );
}

function PodiumStep({ entry, rank, threshold }: { entry: RecommendationEntry; rank: number; threshold: number }) {
  const first = rank === 1;
  const { game } = entry;
  return (
    <li className="reveal flex min-w-0 flex-col" style={{ '--i': rank } as CSSProperties}>
      <Link
        to={`/jogo/${game.id}`}
        aria-label={`${rank}º lugar: ${game.name}`}
        className={`group relative block aspect-[264/374] overflow-hidden rounded-md bg-surface-2 transition-[translate,box-shadow] duration-300 hover:-translate-y-1.5 ${first ? 'shadow-[0_24px_40px_-14px_rgb(0_0_0/0.65)]' : 'shadow-[0_16px_40px_-14px_rgb(0_0_0/0.65)]'}`}
      >
        {game.cover && (
          <img src={game.cover.url} srcSet={`${game.cover.url} 1x, ${game.cover.url2x} 2x`} alt="" className="size-full object-cover transition-[filter] duration-300 group-hover:brightness-110" />
        )}
        <span
          aria-hidden
          className={[
            'absolute -left-px -top-px flex items-center justify-center rounded-br-md font-display font-extrabold',
            first
              ? 'size-[3.4rem] bg-[linear-gradient(120deg,#fff1c2,#f3d27a_45%,#c48a1d)] text-[1.75rem] text-[#2a1d02]'
              : 'size-11 border border-white/20 bg-[#181818] text-[1.35rem] text-white',
          ].join(' ')}
        >
          {rank}
        </span>
      </Link>

      {/* Degrau: nome, tags, preço e votos; o número da posição ao fundo, em marca d'água. */}
      <div
        className={[
          'relative mt-3 flex flex-col gap-2.5 overflow-hidden rounded-t-md border border-b-0 border-white/10 bg-[#181818]/85 p-3.5 backdrop-blur',
          first ? 'shadow-[inset_0_2px_0_#f3d27a]' : 'shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]',
          STEP_HEIGHT[rank - 1],
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'pointer-events-none absolute -bottom-5 right-2.5 font-display font-extrabold leading-none',
            first
              ? 'bg-[linear-gradient(120deg,#f3d27a,#c48a1d)] bg-clip-text text-[9.5rem] text-transparent'
              : 'text-[7rem] text-white/[0.14]',
          ].join(' ')}
        >
          {rank}
        </span>
        <Link
          to={`/jogo/${game.id}`}
          className={`relative line-clamp-2 font-display font-bold leading-tight text-white hover:underline ${first ? 'text-xl' : 'text-[1.05rem]'}`}
        >
          {game.name}
        </Link>
        {(entry.hasDemo || playersText(entry.players)) && (
          <span className="relative flex flex-wrap items-center gap-2">
            {entry.hasDemo && <DemoTag />}
            <PlayersTag players={entry.players} />
          </span>
        )}
        <span className="relative text-white">
          <CompactPrice game={game} />
        </span>
        <div className="relative">
          <VoteButtons entry={entry} threshold={threshold} compact />
        </div>
      </div>
    </li>
  );
}

function RestRow({
  entry,
  rank,
  threshold,
  index,
}: {
  entry: RecommendationEntry;
  rank: number;
  threshold: number;
  index: number;
}) {
  const { game } = entry;
  const players = playersText(entry.players);
  return (
    <li
      className="reveal flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface p-2.5 pr-3 transition-colors hover:border-line-strong"
      style={{ '--i': index } as CSSProperties}
    >
      <span className="w-8 text-center font-display text-lg font-bold text-muted tabular-nums">{rank}</span>
      <Link to={`/jogo/${game.id}`} className="h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-surface-2" tabIndex={-1} aria-hidden>
        {game.cover && <img src={game.cover.url} alt="" loading="lazy" className="size-full object-cover" />}
      </Link>
      {/* Título, depois DEMO (se houver), um ponto, e o selo de jogadores. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Link to={`/jogo/${game.id}`} className="truncate font-semibold hover:underline">
          {game.name}
        </Link>
        {entry.hasDemo && <DemoTag />}
        {players && <TagDot />}
        <PlayersTag players={entry.players} />
      </div>
      <div className="flex min-w-[13rem] justify-end">
        <CompactPrice game={game} />
      </div>
      <VoteButtons entry={entry} threshold={threshold} compact />
    </li>
  );
}
