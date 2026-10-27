import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string | null;
  /** Classes do contêiner (posicionamento). */
  className?: string;
  /** Classes de cada imagem (object-fit, filtros). */
  imgClassName?: string;
}

/**
 * Imagem que troca com fusão: a nova entra por cima, transparente, e só aparece depois de
 * carregada; quando termina de aparecer, as anteriores saem. Assim nunca pisca em branco.
 */
export function CrossfadeImage({ src, className = '', imgClassName = '' }: Props) {
  const [layers, setLayers] = useState<{ src: string; id: number }[]>(() => (src ? [{ src, id: 0 }] : []));
  const nextId = useRef(1);

  useEffect(() => {
    if (!src) return;
    setLayers((current) =>
      current.at(-1)?.src === src ? current : [...current.slice(-1), { src, id: nextId.current++ }],
    );
  }, [src]);

  return (
    <div aria-hidden className={`overflow-hidden ${className}`}>
      {layers.map((layer, i) => (
        <img
          key={layer.id}
          src={layer.src}
          alt=""
          decoding="async"
          className={`xfade absolute inset-0 size-full ${imgClassName}`}
          onLoad={(event) => {
            event.currentTarget.dataset.loaded = '';
          }}
          onTransitionEnd={i === layers.length - 1 ? () => setLayers((current) => current.slice(-1)) : undefined}
        />
      ))}
    </div>
  );
}
