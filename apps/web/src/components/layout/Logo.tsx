import { Link } from 'react-router';

/** Marca do GameBase: o "G" sobre uma base, e o nome com "Base" no gradiente. */
export function Logo() {
  return (
    <Link to="/" className="group inline-flex shrink-0 items-center gap-2" aria-label="GameBase, página inicial">
      <svg viewBox="0 0 64 64" aria-hidden className="size-8 transition-transform duration-300 group-hover:-rotate-6">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand-a)" />
            <stop offset=".55" stopColor="var(--brand-b)" />
            <stop offset="1" stopColor="var(--brand-c)" />
          </linearGradient>
        </defs>
        <path
          d="M44 22.5A15 15 0 1 0 47 33H33"
          fill="none"
          stroke="url(#logo-g)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="14" y="50" width="36" height="5" rx="2.5" fill="url(#logo-g)" />
      </svg>
      <span className="hidden font-display text-xl font-extrabold tracking-tight sm:inline">
        Game<span className="wordmark">Base</span>
      </span>
    </Link>
  );
}
