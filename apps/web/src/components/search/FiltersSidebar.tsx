import type { SearchFacets, SearchFilters } from '@rj/shared';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { OPEN_FILTERS_EVENT } from '../../lib/events';
import { label } from '../../lib/labels';
import { activeFilterCount } from '../../lib/searchParams';

const PRICE_OPTIONS = [
  ['free', 'Grátis'],
  ['demo', 'Pago, com demo grátis'],
  ['paid', 'Pago, sem demo'],
] as const;

const PLAYER_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 32, 64];
const RATING_OPTIONS = [60, 70, 80, 90];
const GENRES_COLLAPSED = 8;

interface Props {
  filters: SearchFilters;
  facets: SearchFacets | undefined;
  onChange: (patch: Partial<SearchFilters>) => void;
  onClear: () => void;
  /** Abrir já expandido no celular (quando se chega pelo botão "Filtros"). */
  initiallyOpen?: boolean;
}

/** Barra lateral de filtros da busca, com seções sanfonadas. No celular, recolhe num botão. */
export function FiltersSidebar({ filters, facets, onChange, onClear, initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const [allGenres, setAllGenres] = useState(false);
  const root = useRef<HTMLElement>(null);
  const count = activeFilterCount(filters);

  // Botão "Filtros" da barra do topo, já estando na busca: abre e leva o foco para cá.
  useEffect(() => {
    const focus = () => {
      setOpen(true);
      requestAnimationFrame(() => {
        root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        root.current?.querySelector<HTMLElement>('select, input, button')?.focus({ preventScroll: true });
      });
    };
    window.addEventListener(OPEN_FILTERS_EVENT, focus);
    return () => window.removeEventListener(OPEN_FILTERS_EVENT, focus);
  }, []);

  const toggleIn = <T,>(list: T[] | undefined, value: T) =>
    list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];

  const genres = facets?.genres ?? [];
  const shownGenres = allGenres
    ? genres
    : genres.filter((g, i) => i < GENRES_COLLAPSED || filters.genres?.includes(g.id));

  return (
    <aside ref={root} aria-label="Filtros" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filtros-corpo"
        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 font-semibold lg:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros{count > 0 && ` (${count})`}
        </span>
        <ChevronDown className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      <div
        id="filtros-corpo"
        className={`${open ? 'block' : 'hidden'} mt-3 overflow-hidden rounded-xl border border-line bg-surface lg:mt-0 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Filtros</h2>
          {count > 0 && (
            <button type="button" onClick={onClear} className="text-xs font-semibold text-brand-b hover:underline">
              Limpar ({count})
            </button>
          )}
        </div>

        <Group title="Jogadores online" defaultOpen>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Pelo menos</span>
            <select
              value={filters.players ?? ''}
              onChange={(e) => onChange({ players: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-ink"
            >
              <option value="">Qualquer quantidade</option>
              {PLAYER_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} jogadores
                </option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label="Tipo de partida" className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-sm">
            {(
              [
                [undefined, 'Online'],
                ['coop', 'Coop online'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={filters.mode === value}
                onClick={() => onChange({ mode: value })}
                className={[
                  'rounded-md px-2 py-1.5 font-semibold transition-colors',
                  filters.mode === value ? 'bg-brand-b text-white' : 'text-muted hover:text-ink',
                ].join(' ')}
              >
                {text}
              </button>
            ))}
          </div>
          <Check
            checked={Boolean(filters.unknownPlayers)}
            disabled={!filters.players}
            onChange={(v) => onChange({ unknownPlayers: v || undefined })}
          >
            Incluir jogos sem informação de jogadores
          </Check>
        </Group>

        <Group title="Preço" hint={allHint(filters.prices, 'Todos')} defaultOpen>
          {PRICE_OPTIONS.map(([value, text]) => (
            <Check
              key={value}
              checked={Boolean(filters.prices?.includes(value))}
              onChange={() => onChange({ prices: toggleIn(filters.prices, value) })}
            >
              {text}
            </Check>
          ))}
        </Group>

        <Group title="Lojas" hint={allHint(filters.stores, 'Todas')} defaultOpen={Boolean(filters.stores?.length)}>
          {(facets?.stores ?? []).map((store) => (
            <Check
              key={store.key}
              checked={Boolean(filters.stores?.includes(store.key))}
              onChange={() => onChange({ stores: toggleIn(filters.stores, store.key) })}
            >
              {store.name}
            </Check>
          ))}
        </Group>

        <Group title="Gêneros" hint={allHint(filters.genres, 'Todos')} defaultOpen={Boolean(filters.genres?.length)}>
          {shownGenres.map((genre) => (
            <Check
              key={genre.id}
              checked={Boolean(filters.genres?.includes(genre.id))}
              onChange={() => onChange({ genres: toggleIn(filters.genres, genre.id) })}
            >
              {label(genre.name)}
            </Check>
          ))}
          {genres.length > GENRES_COLLAPSED && (
            <button
              type="button"
              onClick={() => setAllGenres((v) => !v)}
              className="mt-1 text-sm font-semibold text-brand-b hover:underline"
            >
              {allGenres ? 'Ver menos' : `Ver todos (${genres.length})`}
            </button>
          )}
        </Group>

        <Group title="Lançamento" defaultOpen={Boolean(filters.yearMin || filters.yearMax)}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <YearInput label="De" value={filters.yearMin} onCommit={(yearMin) => onChange({ yearMin })} />
            <YearInput label="Até" value={filters.yearMax} onCommit={(yearMax) => onChange({ yearMax })} />
          </div>
        </Group>

        <Group title="Resultados" defaultOpen={Boolean(filters.showDuplicates)}>
          <Check
            checked={Boolean(filters.showDuplicates)}
            onChange={(v) => onChange({ showDuplicates: v || undefined })}
          >
            Mostrar duplicatas e edições separadas
          </Check>
        </Group>

        <Group title="Nota mínima" defaultOpen={Boolean(filters.ratingMin)} last>
          <div role="radiogroup" aria-label="Nota mínima" className="flex flex-wrap gap-1.5">
            {[undefined, ...RATING_OPTIONS].map((value) => (
              <button
                key={value ?? 'qualquer'}
                type="button"
                role="radio"
                aria-checked={filters.ratingMin === value}
                onClick={() => onChange({ ratingMin: value })}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  filters.ratingMin === value ? 'bg-brand-b text-white' : 'bg-surface-2 text-ink hover:brightness-110',
                ].join(' ')}
              >
                {value ? `${value / 10}+` : 'Qualquer'}
              </button>
            ))}
          </div>
        </Group>
      </div>
    </aside>
  );
}

/** Nada marcado vale como tudo marcado: o cabeçalho diz "Todas"; senão, quantas estão marcadas. */
function allHint(list: unknown[] | undefined, allText: string): string {
  return list?.length ? `${list.length} ${list.length === 1 ? 'marcada' : 'marcadas'}` : allText;
}

function Group({
  title,
  hint,
  defaultOpen = false,
  last = false,
  children,
}: {
  title: string;
  /** Resumo ao lado do título, como "Todas". */
  hint?: string;
  defaultOpen?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={`group ${last ? '' : 'border-b border-line'}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {hint && <span className="ml-2 text-xs font-normal text-muted">{hint}</span>}
        </span>
        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-1 px-4 pb-4">{children}</div>
    </details>
  );
}

function Check({
  checked,
  disabled = false,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className={`flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm ${disabled ? 'opacity-45' : 'cursor-pointer hover:bg-surface-2'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--brand-b)]"
      />
      {children}
    </label>
  );
}

function YearInput({
  label: text,
  value,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? '');
  useEffect(() => setDraft(value?.toString() ?? ''), [value]);
  const commit = () => {
    const n = Number.parseInt(draft, 10);
    onCommit(Number.isFinite(n) && n >= 1950 && n <= 2100 ? n : undefined);
  };
  return (
    <label>
      <span className="mb-1 block text-muted">{text}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1950}
        max={2100}
        placeholder="Ano"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-ink"
      />
    </label>
  );
}
