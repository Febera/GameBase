import { EyeOff, SearchX } from 'lucide-react';
import { type CSSProperties, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { CardRow } from '../components/game/CardRow';
import { About } from '../components/gamepage/About';
import { Details } from '../components/gamepage/Details';
import { InfoColumn } from '../components/gamepage/InfoColumn';
import { MediaViewer } from '../components/gamepage/MediaViewer';
import { PlayTogether } from '../components/gamepage/PlayTogether';
import { WhereToBuy } from '../components/gamepage/WhereToBuy';
import { RecommendButton } from '../components/recommendations/RecommendButton';
import { ErrorState } from '../components/ui/ErrorState';
import { SlowServerNote } from '../components/ui/SlowServerNote';
import { useGame } from '../hooks/useGame';
import { useSlowLoading } from '../hooks/useSlowLoading';
import { ApiError } from '../lib/apiClient';
import { gameToCard } from '../lib/cards';
import { openOptionsPanel } from '../lib/events';

export function GamePage() {
  const id = Number(useParams().id);
  const { data: game, isPending, isError, error, refetch } = useGame(id);
  const slow = useSlowLoading(isPending);

  useEffect(() => {
    document.title = game ? `${game.name} · GameBase` : 'GameBase';
  }, [game]);

  if (isError) {
    if (error instanceof ApiError && error.code === 'adult_content') return <AdultNotice />;
    if (error instanceof ApiError && error.status === 404) return <NotFoundNotice />;
    return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  }

  if (isPending || !game) {
    return (
      <div aria-busy className="space-y-6">
        <div className="h-80 skeleton rounded-2xl " />
        {slow && <SlowServerNote />}
      </div>
    );
  }

  const year = game.releaseDate?.slice(0, 4);
  const byline = [year, game.developers[0]].filter(Boolean).join(' · ');

  return (
    <article className="relative space-y-8">
      <HeroBackdrop image={game.heroImage} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{game.name}</h1>
          {byline && <p className="mt-1 text-muted">{byline}</p>}
        </div>
        <RecommendButton gameId={game.id} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <MediaViewer game={game} />
        <InfoColumn game={game} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="min-w-0 space-y-8">
          <WhereToBuy game={game} />
          <About game={game} />
        </div>
        <aside className="space-y-6">
          <PlayTogether game={game} />
          <Details game={game} />
        </aside>
      </div>

      {game.similar.length > 0 && (
        <section aria-labelledby="similares" style={{ '--accent': 'var(--accent-new)' } as CSSProperties}>
          <CardRow
            heading={
              <h2 id="similares" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                Jogos parecidos
              </h2>
            }
            cards={game.similar.map(gameToCard)}
          />
        </section>
      )}
    </article>
  );
}

/**
 * Fundo da página do jogo: a arte ocupa o topo, na largura toda da tela, e some até a cor da
 * página pelo gradiente --hero-fade (transparente no topo, cor sólida a partir da metade).
 */
export function HeroBackdrop({ image }: { image: string | null }) {
  if (!image) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[calc(-5.5rem-env(safe-area-inset-top,0px))] -z-10 h-[46rem] w-screen -translate-x-1/2 overflow-hidden"
    >
      <img src={image} alt="" className="size-full object-cover object-top" />
      <div className="absolute inset-0" style={{ background: 'var(--hero-fade)' }} />
    </div>
  );
}

export function AdultNotice() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <EyeOff className="mx-auto size-10 text-muted" aria-hidden />
      <h1 className="mt-4 font-display text-2xl font-bold">Jogo oculto pelo filtro</h1>
      <p className="mt-2 text-muted">
        Este jogo tem foco em conteúdo sexual. Para vê-lo, desligue o filtro em Opções.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={openOptionsPanel}
          className="rounded-lg bg-brand-b px-4 py-2 font-semibold text-white hover:brightness-110"
        >
          Abrir Opções
        </button>
        <Link to="/" className="rounded-lg bg-surface-2 px-4 py-2 font-semibold hover:brightness-110">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function NotFoundNotice() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <SearchX className="mx-auto size-10 text-muted" aria-hidden />
      <h1 className="mt-4 font-display text-2xl font-bold">Jogo não encontrado</h1>
      <p className="mt-2 text-muted">Esse jogo não existe na IGDB ou foi removido.</p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-surface-2 px-4 py-2 font-semibold hover:brightness-110">
        Voltar ao início
      </Link>
    </div>
  );
}
