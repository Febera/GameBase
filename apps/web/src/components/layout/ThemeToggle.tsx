import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../app/theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const toLight = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={toLight ? 'Usar tema claro' : 'Usar tema escuro'}
      title={toLight ? 'Tema claro' : 'Tema escuro'}
      className="flex size-10 items-center justify-center rounded-md text-[var(--topbar-muted)] transition-colors hover:bg-surface-2/70 hover:text-ink"
    >
      {toLight ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
