import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useDebounced, useSuggestions } from '../../hooks/useSearch';
import { focusFiltersSidebar } from '../../lib/events';
import { QUICK_SEARCHES } from '../../lib/quickSearches';
import { parseSearch, toSearchParams } from '../../lib/searchParams';
import { QUICK_ICONS } from '../ui/quickIcons';

/** Item da lista navegável pelo teclado: sugestão de jogo, busca rápida ou ação. */
type Option = { id: string; run: () => void };

/**
 * Barra de pesquisa (combobox acessível):
 * - campo vazio e focado: painel de buscas rápidas e o atalho para a busca avançada;
 * - digitando: sugestões de jogos;
 * - botão "Filtros" no campo: abre a busca com a barra lateral de filtros.
 */
export function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearchPage = location.pathname === '/busca';
  const [value, setValue] = useState(onSearchPage ? (params.get('q') ?? '') : '');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const listId = useId();
  const root = useRef<HTMLFormElement>(null);

  // Mantém o campo em sincronia com a URL ao navegar.
  useEffect(() => {
    setValue(location.pathname === '/busca' ? (params.get('q') ?? '') : '');
  }, [location.pathname, params]);

  const debounced = useDebounced(value, 250);
  const { data: suggestions = [] } = useSuggestions(debounced, focused);
  const typing = value.trim().length >= 2;
  const showQuick = focused && !dismissed && value.trim() === '';
  const showSuggestions = focused && !dismissed && typing && suggestions.length > 0;
  const open = showQuick || showSuggestions;

  useEffect(() => setActive(-1), [suggestions, showQuick]);

  const leave = () => {
    setDismissed(true);
    root.current?.querySelector('input')?.blur();
  };

  function goToSearch(extra: Parameters<typeof toSearchParams>[0] = {}, replaceFilters = false) {
    const q = value.trim() || undefined;
    const current = onSearchPage && !replaceFilters ? parseSearch(params) : { filters: {}, view: 'list' as const };
    // Texto novo: volta para a ordem padrão (relevância).
    const next = toSearchParams({ ...current.filters, q, sort: undefined, ...extra }, current.view);
    navigate(`/busca${next.toString() ? `?${next}` : ''}`);
  }

  function openAdvanced() {
    leave();
    if (onSearchPage) focusFiltersSidebar();
    else {
      const q = value.trim();
      navigate(q ? `/busca?q=${encodeURIComponent(q)}` : '/busca', { state: { openFilters: true } });
    }
  }

  const options: Option[] = showQuick
    ? [
        ...QUICK_SEARCHES.map((quick) => ({
          id: `quick-${quick.key}`,
          run: () => {
            leave();
            goToSearch(quick.filters, true);
          },
        })),
        { id: 'advanced', run: openAdvanced },
      ]
    : showSuggestions
      ? [
          ...suggestions.map((s) => ({
            id: `game-${s.id}`,
            run: () => {
              leave();
              navigate(`/jogo/${s.id}`);
            },
          })),
          {
            id: 'all',
            run: () => {
              leave();
              goToSearch();
            },
          },
        ]
      : [];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (open && active >= 0 && options[active]) options[active].run();
    else {
      leave();
      goToSearch();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      setDismissed(false);
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === 'Escape') {
      setDismissed(true);
    }
  }

  const optionProps = (index: number) => ({
    id: `${listId}-${options[index]?.id}`,
    role: 'option' as const,
    'aria-selected': index === active,
    onMouseDown: (e: ReactMouseEvent) => e.preventDefault(),
    onClick: () => options[index]?.run(),
    // onMouseMove (e não onMouseEnter): a lista abrindo sob o cursor parado não destaca nada.
    onMouseMove: () => active !== index && setActive(index),
  });

  return (
    <form ref={root} role="search" onSubmit={submit} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--topbar-muted)]" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDismissed(false);
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={(e) => {
          if (!root.current?.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        onKeyDown={onKeyDown}
        placeholder="Buscar jogos pelo nome"
        aria-label="Buscar jogos"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && options[active] ? `${listId}-${options[active].id}` : undefined}
        autoComplete="off"
        className="search-field h-10 w-full rounded-md border border-line bg-surface pl-9 pr-[6.5rem] text-sm text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted hover:border-line-strong focus:border-brand-b focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand-b)_25%,transparent)] focus:outline-none"
      />
      <button
        type="button"
        onClick={openAdvanced}
        className="filters-button absolute right-1 top-1 flex h-8 items-center gap-1.5 rounded-r-sm border-l border-line-strong pl-3 pr-2.5 text-[0.8rem] font-bold text-[var(--filters-color)] transition-colors hover:bg-surface-2"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={showQuick ? 'Buscas rápidas' : 'Sugestões'}
          className="pop-in absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-line bg-surface text-ink shadow-2xl"
        >
          {showQuick ? (
            <>
              <p className="px-4 pb-1.5 pt-3.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted">Buscas rápidas</p>
              <div className="grid gap-0.5 px-2 pb-2.5 sm:grid-cols-2">
                {QUICK_SEARCHES.map((quick, i) => {
                  const { icon: Icon, color } = QUICK_ICONS[quick.key]!;
                  return (
                    <div
                      key={quick.key}
                      {...optionProps(i)}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 ${i === active ? 'bg-surface-2' : ''}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2" style={{ color }}>
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{quick.label}</span>
                        <span className="block truncate text-xs text-muted">{quick.description}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                {...optionProps(QUICK_SEARCHES.length)}
                className={`flex cursor-pointer items-center gap-3 border-t border-line px-4 py-3.5 ${active === QUICK_SEARCHES.length ? 'bg-surface-2' : 'bg-bg/40'}`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-b text-[#06202b]">
                  <SlidersHorizontal className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-brand-b">Abrir busca avançada</span>
                  <span className="block truncate text-xs text-muted">Jogadores, preço, lojas, gêneros, ano, nota e duplicatas</span>
                </span>
                <ArrowRight className="size-[18px] text-brand-b" aria-hidden />
              </div>
            </>
          ) : (
            <ul className="py-1">
              {suggestions.map((s, i) => (
                <li key={s.id} {...optionProps(i)} className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-surface-2' : ''}`}>
                  <span className="h-12 w-9 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                    {s.cover && <img src={s.cover} alt="" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    {s.year && <span className="text-xs text-muted tabular-nums">{s.year}</span>}
                  </span>
                </li>
              ))}
              <li
                {...optionProps(suggestions.length)}
                className={`cursor-pointer border-t border-line px-3 py-2 text-sm font-semibold text-brand-b ${active === suggestions.length ? 'bg-surface-2' : ''}`}
              >
                Ver todos os resultados para “{value.trim()}”
              </li>
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
