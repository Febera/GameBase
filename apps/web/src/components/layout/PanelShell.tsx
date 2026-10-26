import { X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';

interface Props {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Painel que abre logo abaixo da barra do topo. Fecha com Esc ou pelo botão. */
export function PanelShell({ id, title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section id={id} aria-label={title} className="panel-enter border-t border-line bg-surface">
      <div className="w-full px-4 py-6 sm:px-5 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-6">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Fechar ${title.toLowerCase()}`}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="max-w-2xl">{children}</div>
      </div>
    </section>
  );
}
