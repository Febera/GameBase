import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

interface Props {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Total de jogos na lista completa, quando já carregou. */
  total?: number | undefined;
  /** Aviso curto em destaque ao lado do subtítulo, como "3 acabam esta semana". */
  highlight?: string | null;
}

/** Cabeçalho de uma seção da home: ícone na cor da seção, título, o que entra nela e o total. */
export function SectionHeader({ id, href, title, subtitle, icon: Icon, total, highlight }: Props) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          aria-hidden
          className="hidden size-11 shrink-0 items-center sm:flex justify-center rounded-md bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_32%,transparent)]"
        >
          <Icon className="size-[22px]" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="font-display text-2xl font-bold tracking-tight md:text-[1.75rem]">
            <Link to={href} className="group inline-flex items-center gap-1.5">
              <span className="transition-colors group-hover:text-[var(--accent)]">{title}</span>
              <ChevronRight
                aria-hidden
                className="size-6 text-muted transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]"
              />
            </Link>
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
            <span>{subtitle}</span>
            {highlight && (
              <span className="rounded-sm bg-[var(--accent)] px-1.5 py-px text-xs font-bold text-[var(--on-accent)]">
                {highlight}
              </span>
            )}
          </p>
        </div>
      </div>
      {total !== undefined && total > 0 && (
        <Link
          to={href}
          className="hidden shrink-0 items-center gap-2 rounded-md border border-line-strong px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:border-[var(--accent)] hover:text-ink sm:inline-flex"
        >
          Ver todos
          <span className="rounded-sm bg-surface-2 px-1.5 text-xs font-bold tabular-nums text-ink">{total}</span>
          <span className="sr-only">: {title}</span>
        </Link>
      )}
    </div>
  );
}
