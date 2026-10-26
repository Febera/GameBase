import type { Screenshot } from '@rj/shared';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Props {
  screenshots: Screenshot[];
  index: number | null;
  onChange: (index: number | null) => void;
}

/** Visualizador de screenshots em tela cheia. Setas do teclado navegam, Esc fecha. */
export function Lightbox({ screenshots, index, onChange }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = index !== null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const go = (delta: number) => {
    if (index === null) return;
    onChange((index + delta + screenshots.length) % screenshots.length);
  };

  const current = index !== null ? screenshots[index] : undefined;

  return (
    <dialog
      ref={dialog}
      onClose={() => onChange(null)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') go(1);
        if (event.key === 'ArrowLeft') go(-1);
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onChange(null);
      }}
      aria-label="Screenshots"
      className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/85"
    >
      {current && (
        <div className="relative flex h-dvh w-dvw items-center justify-center p-4 md:p-12">
          <img src={current.full} alt={`Screenshot ${index! + 1} de ${screenshots.length}`} className="max-h-full max-w-full rounded-lg object-contain" />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white tabular-nums">
            {index! + 1} / {screenshots.length}
          </p>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <X className="size-6" aria-hidden />
          </button>
          {screenshots.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Próxima"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
