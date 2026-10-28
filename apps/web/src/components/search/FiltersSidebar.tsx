import type { SearchFacets, SearchFilters } from '@rj/shared';
import { Check as CheckIcon, ChevronDown, Gift, type LucideIcon, SlidersHorizontal, Tag, Timer, X } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { OPEN_FILTERS_EVENT } from '../../lib/events';
import { label } from '../../lib/labels';
import { activeFilterCount } from '../../lib/searchParams';

const PRICE_OPTIONS: readonly (readonly ['free' | 'demo' | 'paid', string, LucideIcon, string])[] = [
  ['free', 'Grátis', Gift, 'var(--accent-free)'],
  ['demo', 'Pago com demo', Timer, 'var(--accent-new)'],
  ['paid', 'Pago sem demo', Tag, 'var(--accent-paid)'],
];

/** Botões de "pelo menos N jogadores"; um valor fora da lista (vindo de um link) aparece também. */
const PLAYER_OPTIONS = [2, 3, 4, 6, 8, 12, 16, 32];
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
    <aside ref={root} aria-label="Filtros" className="filters-aside scroll-mt-24 lg:sticky lg:self-start">
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
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filtros
            {count > 0 && <CountBadge n={count} />}
          </h2>
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand-b hover:text-brand-b"
            >
              <X className="size-3.5" aria-hidden />
              Limpar tudo
            </button>
          )}
        </div>

        <Group title="Jogadores online" count={filters.players || filters.mode ? 1 : 0} defaultOpen>
          <p className="mb-1.5 text-sm text-muted">Pelo menos</p>
          <div role="radiogroup" aria-label="Jogadores online, pelo menos" className="grid grid-cols-5 gap-1.5">
            {[undefined, ...playerChoices(filters.players)].map((n) => (
              <button
                key={n ?? 'qualquer'}
                type="button"
                role="radio"
                aria-checked={filters.players === n}
                onClick={() => onChange({ players: n, ...(n ? {} : { unknownPlayers: undefined }) })}
                className={[
                  'filter-chip rounded-md px-1 py-1.5 text-sm font-bold tabular-nums',
                  n === undefined ? 'col-span-2' : '',
                ].join(' ')}
              >
                {n === undefined ? 'Qualquer' : `${n}+`}
              </button>
            ))}
          </div>
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
                  filters.mode === value ? 'bg-brand-b text-[#06202b]' : 'text-muted hover:text-ink',
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

        <Group title="Preço" hint="Todos" count={filters.prices?.length} defaultOpen>
          <div className="flex flex-wrap gap-1.5">
            {PRICE_OPTIONS.map(([value, text, Icon, color]) => (
              <ToggleChip
                key={value}
                pressed={Boolean(filters.prices?.includes(value))}
                onClick={() => onChange({ prices: toggleIn(filters.prices, value) })}
                icon={Icon}
                color={color}
              >
                {text}
              </ToggleChip>
            ))}
          </div>
        </Group>

        <Group title="Lojas" hint="Todas" count={filters.stores?.length} defaultOpen={Boolean(filters.stores?.length)}>
          <div className="flex flex-wrap gap-1.5">
            {(facets?.stores ?? []).map((store) => (
              <ToggleChip
                key={store.key}
                pressed={Boolean(filters.stores?.includes(store.key))}
                onClick={() => onChange({ stores: toggleIn(filters.stores, store.key) })}
              >
                {store.name}
              </ToggleChip>
            ))}
          </div>
        </Group>

        <Group title="Gêneros" hint="Todos" count={filters.genres?.length} defaultOpen={Boolean(filters.genres?.length)}>
          <div className="flex flex-wrap gap-1.5">
            {shownGenres.map((genre) => (
              <ToggleChip
                key={genre.id}
                pressed={Boolean(filters.genres?.includes(genre.id))}
                onClick={() => onChange({ genres: toggleIn(filters.genres, genre.id) })}
              >
                {label(genre.name)}
              </ToggleChip>
            ))}
          </div>
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

        <Group title="Lançamento" count={filters.yearMin || filters.yearMax ? 1 : 0} defaultOpen={Boolean(filters.yearMin || filters.yearMax)}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <YearInput label="De" value={filters.yearMin} onCommit={(yearMin) => onChange({ yearMin })} />
            <YearInput label="Até" value={filters.yearMax} onCommit={(yearMax) => onChange({ yearMax })} />
          </div>
        </Group>

        <Group title="Resultados" count={filters.showDuplicates ? 1 : 0} defaultOpen={Boolean(filters.showDuplicates)}>
          <Check
            checked={Boolean(filters.showDuplicates)}
            onChange={(v) => onChange({ showDuplicates: v || undefined })}
          >
            Mostrar duplicatas e edições separadas
          </Check>
        </Group>

        <Group title="Nota mínima" count={filters.ratingMin ? 1 : 0} defaultOpen={Boolean(filters.ratingMin)} last>
          <div role="radiogroup" aria-label="Nota mínima" className="flex flex-wrap gap-1.5">
            {[undefined, ...RATING_OPTIONS].map((value) => (
              <button
                key={value ?? 'qualquer'}
                type="button"
                role="radio"
                aria-checked={filters.ratingMin === value}
                onClick={() => onChange({ ratingMin: value })}
                className="filter-chip rounded-md px-3 py-1.5 text-sm font-bold"
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

/** Opções de jogadores, incluindo o valor atual se ele não estiver entre as padrão. */
function playerChoices(current: number | undefined): number[] {
  return current && !PLAYER_OPTIONS.includes(current)
    ? [...PLAYER_OPTIONS, current].sort((a, b) => a - b)
    : PLAYER_OPTIONS;
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-b px-1.5 text-[0.7rem] font-extrabold tabular-nums text-[#06202b]">
      {n}
    </span>
  );
}

/** Botão liga/desliga de um filtro: contorno quando desligado; tingido e com ✓ quando ligado. */
function ToggleChip({
  pressed,
  onClick,
  icon: Icon,
  color = 'var(--brand-b)',
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  color?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="filter-chip inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold"
      style={{ '--chip': color } as CSSProperties}
    >
      {pressed ? (
        <CheckIcon className="size-3.5" aria-hidden />
      ) : (
        Icon && <Icon className="size-3.5" style={{ color }} aria-hidden />
      )}
      {children}
    </button>
  );
}

function Group({
  title,
  hint,
  count = 0,
  defaultOpen = false,
  last = false,
  children,
}: {
  title: string;
  /** Resumo ao lado do título quando nada está marcado, como "Todas". */
  hint?: string;
  /** Quantos filtros desta seção estão ativos (mostrado mesmo com a seção recolhida). */
  count?: number;
  defaultOpen?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={`group ${last ? '' : 'border-b border-line'}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          {title}
          {count > 0 ? <CountBadge n={count} /> : hint && <span className="text-xs font-normal text-muted">{hint}</span>}
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
