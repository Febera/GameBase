import type { GameDetails } from '@rj/shared';
import { Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { EdgeArrows } from '../game/EdgeArrows';
import { Lightbox } from './Lightbox';

type Item =
  | { kind: 'video'; key: string; youtubeId: string; name: string; thumb: string }
  | { kind: 'image'; key: string; thumb: string; full: string; shotIndex: number };

function itemsOf(game: GameDetails): Item[] {
  const videos: Item[] = game.videos.slice(0, 2).map((v) => ({
    kind: 'video',
    key: `v-${v.youtubeId}`,
    youtubeId: v.youtubeId,
    name: v.name,
    thumb: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`,
  }));
  const shots: Item[] = game.screenshots.slice(0, 12).map((s, i) => ({
    kind: 'image',
    key: `s-${s.thumb}`,
    thumb: s.thumb,
    full: s.full,
    shotIndex: i,
  }));
  return [...videos, ...shots];
}

/** Sem miniatura (YouTube indisponível, por exemplo), fica só o fundo. */
const hideOnError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.style.visibility = 'hidden';
};

/**
 * Palco grande de mídia com faixa de miniaturas: trailers primeiro, depois screenshots.
 * O trailer só carrega o player do YouTube ao clicar; screenshots abrem em tela cheia.
 */
export function MediaViewer({ game }: { game: GameDetails }) {
  const items = itemsOf(game);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const strip = useRef<HTMLUListElement>(null);
  const current = items[index];

  const select = (i: number) => {
    setIndex(i);
    setPlaying(false);
  };

  if (!current) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-2 text-muted">
        Sem imagens ou vídeos deste jogo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div key={current.key} className="reveal relative aspect-video overflow-hidden rounded-md bg-surface-2 shadow-2xl">
        {current.kind === 'video' ? (
          playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${current.youtubeId}?autoplay=1&rel=0`}
              title={current.name}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="size-full"
            />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="group relative size-full" aria-label={`Assistir: ${current.name}`}>
              <img src={current.thumb} alt="" onError={hideOnError} className="size-full object-cover" />
              <span className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/15" />
              <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-105">
                <Play className="ml-1 size-7 fill-current" aria-hidden />
              </span>
              <span className="absolute bottom-3 left-3 rounded-md bg-black/65 px-2 py-1 text-sm font-semibold text-white">
                {current.name}
              </span>
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => setLightbox(current.shotIndex)}
            className="size-full cursor-zoom-in"
            aria-label="Ver screenshot em tela cheia"
          >
            <img src={current.full} alt="" className="size-full object-cover" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="relative">
          <ul ref={strip} className="-my-1 flex gap-3 overflow-x-auto px-0.5 py-1 [scrollbar-width:none]" aria-label="Mídia">
            {items.map((item, i) => (
              <li key={item.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => select(i)}
                  aria-label={item.kind === 'video' ? item.name : `Screenshot ${item.shotIndex + 1}`}
                  aria-current={i === index}
                  className={[
                    'relative block aspect-video w-32 overflow-hidden rounded-md bg-surface-2 transition duration-200 md:w-40',
                    i === index ? 'ring-2 ring-brand-b' : 'opacity-60 hover:-translate-y-0.5 hover:opacity-100',
                  ].join(' ')}
                >
                  <img src={item.thumb} alt="" loading="lazy" onError={hideOnError} className="size-full object-cover" />
                  {item.kind === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                      <Play className="size-5 fill-current" aria-hidden />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <EdgeArrows track={strip} contentKey={items.length} labels={{ previous: 'Mídia anterior', next: 'Próxima mídia' }} />
        </div>
      )}

      <Lightbox screenshots={game.screenshots} index={lightbox} onChange={setLightbox} />
    </div>
  );
}
