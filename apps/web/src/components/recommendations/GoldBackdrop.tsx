import { Sparkle } from 'lucide-react';
import type { CSSProperties } from 'react';

/** Faíscas brancas em posições fixas (não "pulam" a cada render), piscando em tempos diferentes. */
const SPARKLES = [
  { left: '6%', top: '10%', size: 18, delay: '0s' },
  { left: '14%', top: '38%', size: 10, delay: '0.7s' },
  { left: '27%', top: '16%', size: 14, delay: '1.4s' },
  { left: '38%', top: '44%', size: 9, delay: '0.3s' },
  { left: '49%', top: '9%', size: 20, delay: '1.1s' },
  { left: '58%', top: '34%', size: 11, delay: '1.8s' },
  { left: '69%', top: '18%', size: 16, delay: '0.5s' },
  { left: '81%', top: '8%', size: 10, delay: '1.6s' },
  { left: '88%', top: '40%', size: 14, delay: '0.9s' },
  { left: '95%', top: '24%', size: 9, delay: '2s' },
];

/**
 * Fundo do pódio: o mesmo dourado do "menor preço da história", com o reflexo atravessando e
 * faíscas brancas, sumindo até a cor da página na parte de baixo. Passa por baixo da barra do topo.
 */
export function GoldBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[calc(-5.5rem-env(safe-area-inset-top,0px))] -z-10 h-[60rem] w-screen -translate-x-1/2 overflow-hidden"
    >
      <div className="gold-panel absolute inset-0" />
      {SPARKLES.map((s) => (
        <Sparkle
          fill="white"
          key={`${s.left}-${s.top}`}
          className="sparkle text-white"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, color: '#ffffff' } as CSSProperties}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,color-mix(in_srgb,var(--bg)_85%,transparent)_78%,var(--bg)_100%)]" />
    </div>
  );
}
