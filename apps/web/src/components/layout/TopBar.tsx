import { Settings, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useHideOnScroll } from '../../hooks/useHideOnScroll';
import { OPEN_OPTIONS_EVENT } from '../../lib/events';
import { Logo } from './Logo';
import { OptionsPanel } from './OptionsPanel';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';

/**
 * Barra do topo na largura toda da tela: marca à esquerda, busca no centro, ações à direita.
 * Some ao rolar para baixo e volta ao subir.
 */
export function TopBar() {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const hidden = useHideOnScroll(optionsOpen || focusInside);
  // Publica o estado na raiz: barras fixas da página (ordenação da busca, filtros) sobem junto.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-topbar-hidden', hidden);
    return () => document.documentElement.removeAttribute('data-topbar-hidden');
  }, [hidden]);
  // Páginas com fundo de arte (home, jogo, oferta) ou dourado (recomendações): barra translúcida e desfocada.
  const { pathname } = useLocation();
  const glass =
    pathname === '/' || pathname.startsWith('/jogo/') || pathname.startsWith('/oferta/') || pathname === '/recomendacoes';

  useEffect(() => {
    const open = () => setOptionsOpen(true);
    window.addEventListener(OPEN_OPTIONS_EVENT, open);
    return () => window.removeEventListener(OPEN_OPTIONS_EVENT, open);
  }, []);

  return (
    <header
      onFocus={() => setFocusInside(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
      }}
      className={[
        'fixed inset-x-0 top-0 z-40 border-b pt-[env(safe-area-inset-top,0px)]',
        glass ? 'topbar-glass' : 'border-line bg-topbar',
        'transition-transform duration-200 ease-out',
        hidden ? '-translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      <div className="grid h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-5 md:grid-cols-[1fr_minmax(0,40rem)_1fr] md:gap-6 lg:px-8">
        <div className="justify-self-start">
          <Logo />
        </div>

        <SearchBar />

        <nav className="flex items-center justify-self-end sm:gap-1">
          <NavLink
            to="/recomendacoes"
            className={({ isActive }) =>
              [
                'flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                isActive ? 'bg-surface-2/80 text-ink' : 'text-[var(--topbar-muted)] hover:bg-surface-2/70 hover:text-ink',
              ].join(' ')
            }
          >
            <Trophy className="size-4" aria-hidden />
            <span className="hidden lg:inline">Recomendações</span>
          </NavLink>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOptionsOpen((open) => !open)}
            aria-expanded={optionsOpen}
            aria-controls="painel-opcoes"
            aria-label="Opções"
            title="Opções"
            className={[
              'flex size-10 items-center justify-center rounded-md transition-colors',
              optionsOpen ? 'bg-surface-2/80 text-ink' : 'text-[var(--topbar-muted)] hover:bg-surface-2/70 hover:text-ink',
            ].join(' ')}
          >
            <Settings className={`size-5 transition-transform duration-300 ${optionsOpen ? 'rotate-90' : ''}`} aria-hidden />
          </button>
        </nav>
      </div>

      {optionsOpen && <OptionsPanel onClose={() => setOptionsOpen(false)} />}
    </header>
  );
}
