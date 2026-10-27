import type { RecommendationEntry } from '@rj/shared';
import { Megaphone, ThumbsUp, Trophy } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import { useBoard } from '../../hooks/useRecommendations';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { VoteButtons } from '../recommendations/VoteButtons';
import { CompactPrice } from '../ui/CompactPrice';
import { DemoTag, PlayersTag } from '../ui/GameTags';
import { CrossfadeImage } from './CrossfadeImage';
import { SectionArt } from './SectionArt';

/** Quantos jogos do placar o destaque percorre. */
const TOP = 5;
/** Tempo de cada jogo no destaque (a barra de progresso no seletor usa o mesmo valor). */
const ROTATE_MS = 8000;

/**
 * Abertura da home: o placar do grupo em destaque. A arte do jogo ocupa o topo da tela,
 * na largura toda, e o seletor ao lado percorre o top 5 sozinho (pausa com o mouse ou o foco
 * dentro do destaque; parado para quem pede menos movimento).
 */
export function GroupHero() {
  const { data, isPending, isError } = useBoard();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  // Sem banco ou com o servidor fora, a home segue sem o destaque.
  if (isError) return null;
  if (isPending) return <HeroSkeleton />;

  const top = data.entries.slice(0, TOP);
  if (top.length === 0) return <HeroEmpty />;

  const index = Math.min(selected, top.length - 1);
  const entry = top[index]!;
  const { game } = entry;
  const rotating = !reducedMotion && top.length > 1;
  const image = entry.artwork ?? null;

  return (
    <section
      aria-labelledby="destaque-grupo"
      className="relative isolate mb-10"
      onPointerEnter={(event) => event.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      {/* Arte na largura toda, passando por baixo da barra do topo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[calc(-5.5rem-env(safe-area-inset-top,0px))] -z-10 h-[calc(100%+9rem)] w-screen -translate-x-1/2"
      >
        {/* Sem arte larga na IGDB, o fundo vira a ilustração do pódio (nunca a capa esticada). */}
        <CrossfadeImage src={image} className={`absolute inset-0 ${image ? '' : 'hidden'}`} imgClassName="object-cover object-[center_25%]" />
        {!image && <SectionArt kind="podium" className="hero-art inset-0 h-full" />}
        <div className="hero-scrim absolute inset-0" />
      </div>

      <div className="grid min-h-[27rem] grid-cols-1 items-end gap-8 pt-10 md:min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div key={game.id} className="hero-copy max-w-2xl">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--gold-ink)]">
            <Trophy className="size-4" aria-hidden />
            {index === 0 ? 'Mais recomendado pelo grupo' : `${index + 1}º no placar do grupo`}
          </p>
          <h2
            id="destaque-grupo"
            className="mt-3 line-clamp-2 max-w-[18ch] font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-tight text-ink [text-wrap:balance] md:text-[4.25rem]"
          >
            <Link to={`/jogo/${game.id}`} className="hover:underline hover:decoration-2 hover:underline-offset-8">
              {game.name}
            </Link>
          </h2>
          {entry.genres && entry.genres.length > 0 && (
            <p className="mt-3 text-[0.95rem] text-muted">{entry.genres.slice(0, 3).join(', ')}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {entry.hasDemo && <DemoTag />}
            <PlayersTag players={entry.players} coopFirst />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to={`/jogo/${game.id}`}
              className="rounded-md bg-white px-5 py-2.5 font-bold text-black transition hover:brightness-90"
            >
              Ver jogo
            </Link>
            <span className="text-ink">
              <CompactPrice game={game} />
            </span>
            <VoteButtons entry={entry} threshold={data.removeThreshold} compact />
          </div>
        </div>

        <div>
          <ol aria-label={`Top ${top.length} do placar`} className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {top.map((item, i) => (
              <li key={item.game.id} className="w-[15rem] shrink-0 lg:w-auto">
                <PickerItem
                  entry={item}
                  rank={i + 1}
                  active={i === index}
                  rotating={rotating}
                  paused={paused}
                  onSelect={() => setSelected(i)}
                  onDone={() => setSelected((i + 1) % top.length)}
                />
              </li>
            ))}
          </ol>
          <Link
            to="/recomendacoes"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            Ver placar completo
            {data.entries.length > TOP && <span className="tabular-nums">({data.entries.length} jogos)</span>}
          </Link>
        </div>
      </div>
    </section>
  );
}

function PickerItem({
  entry,
  rank,
  active,
  rotating,
  paused,
  onSelect,
  onDone,
}: {
  entry: RecommendationEntry;
  rank: number;
  active: boolean;
  rotating: boolean;
  paused: boolean;
  onSelect: () => void;
  onDone: () => void;
}) {
  const { game } = entry;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={`${rank}º: ${game.name}, ${entry.upvotes} ${entry.upvotes === 1 ? 'apoio' : 'apoios'}`}
      className={[
        'hero-pick relative flex w-full items-center gap-3 overflow-hidden rounded-md p-2 text-left backdrop-blur-md transition-colors',
        active ? 'hero-pick-active' : 'opacity-80 hover:bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:opacity-100',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={`w-5 text-center font-display text-lg font-extrabold tabular-nums ${active ? 'text-[var(--gold-ink)]' : 'text-muted'}`}
      >
        {rank}
      </span>
      <span className="h-12 w-9 shrink-0 overflow-hidden rounded-sm bg-surface-2">
        {game.cover && <img src={game.cover.url} alt="" loading="lazy" className="size-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-bold text-ink`}>{game.name}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted tabular-nums">
          <ThumbsUp className="size-3" aria-hidden />
          {entry.upvotes}
        </span>
      </span>
      {active && rotating && (
        <span
          aria-hidden
          className="hero-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[var(--gold-ink)]"
          style={{ animationDuration: `${ROTATE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' } as CSSProperties}
          onAnimationEnd={onDone}
        />
      )}
    </button>
  );
}

function HeroSkeleton() {
  return (
    <div aria-hidden className="mb-10 grid min-h-[27rem] grid-cols-1 items-end gap-8 pt-10 md:min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
      <div className="space-y-4">
        <div className="skeleton h-4 w-48 rounded-sm" />
        <div className="skeleton h-14 w-full max-w-lg rounded-md" />
        <div className="skeleton h-10 w-72 rounded-md" />
      </div>
      <div className="hidden space-y-2 lg:block">
        {Array.from({ length: TOP }, (_, i) => (
          <div key={i} className="skeleton h-16 rounded-md" />
        ))}
      </div>
    </div>
  );
}

/** Placar vazio: o espaço do destaque vira o convite para a primeira recomendação. */
function HeroEmpty() {
  return (
    <section aria-labelledby="destaque-grupo" className="relative isolate mb-10">
      <div className="hero-empty relative overflow-hidden rounded-md border border-line px-6 py-10 md:px-10 md:py-14">
        <Megaphone className="size-8 text-[var(--gold-ink)]" aria-hidden />
        <h2 id="destaque-grupo" className="mt-4 max-w-xl font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          O placar do grupo ainda está vazio
        </h2>
        <p className="mt-2 max-w-lg text-muted">
          Achou um jogo para todo mundo? Abra a página dele e clique em “Recomendar para geral”. O mais apoiado
          aparece aqui, em destaque.
        </p>
        <Link
          to="/busca?jogadores=4&modo=coop"
          className="mt-6 inline-block rounded-md bg-white px-5 py-2.5 font-bold text-black transition hover:brightness-90"
        >
          Procurar jogos coop
        </Link>
      </div>
    </section>
  );
}
