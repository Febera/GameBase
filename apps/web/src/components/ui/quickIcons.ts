import { CalendarDays, Gift, Globe, type LucideIcon, Star, Timer, Users } from 'lucide-react';

/** Ícone e cor de cada busca rápida, usados no painel da busca e nos atalhos da home. */
export const QUICK_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  coop4: { icon: Users, color: 'var(--accent-new)' },
  online8: { icon: Globe, color: 'var(--accent-new)' },
  free: { icon: Gift, color: 'var(--accent-free)' },
  demo: { icon: Timer, color: 'var(--accent-new)' },
  recent: { icon: CalendarDays, color: 'var(--muted)' },
  rated: { icon: Star, color: 'var(--accent-deal)' },
};
