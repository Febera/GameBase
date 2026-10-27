import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { QUICK_SEARCHES } from '../../lib/quickSearches';
import { toSearchParams } from '../../lib/searchParams';
import { QUICK_ICONS } from '../ui/quickIcons';

/** Atalhos da home: as mesmas buscas rápidas da barra do topo, como blocos grandes. */
export function QuickTiles() {
  return (
    <nav aria-label="Buscas rápidas" className="mb-14">
      <ul className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK_SEARCHES.map((quick) => {
          const { icon: Icon, color } = QUICK_ICONS[quick.key]!;
          return (
            <li key={quick.key}>
              <Link
                to={`/busca?${toSearchParams(quick.filters, 'list').toString()}`}
                className="quick-tile group flex h-full items-center gap-3 sm:items-start rounded-md border border-line bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] p-2.5 sm:p-3.5 backdrop-blur-md transition-colors hover:border-[var(--tile)]"
                style={{ '--tile': color } as CSSProperties}
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 sm:size-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--tile)_15%,transparent)] text-[var(--tile)] transition-transform duration-200 group-hover:-translate-y-0.5"
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.95rem] font-bold leading-tight">{quick.label}</span>
                  <span className="mt-1 hidden text-xs leading-snug text-muted sm:block">{quick.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
