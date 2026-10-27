import type { ReactNode } from 'react';

/** Tema da ilustração de fundo de cada seção da home. */
export type ArtKind = 'offers' | 'calendar' | 'controls' | 'charts' | 'podium';

/*
 * Ilustrações de traço fino, no estilo do calendário da loja da Steam: desenhadas aqui mesmo
 * (sem imagens externas), estáticas, na cor da seção e quase da cor do fundo. O SVG cobre a
 * largura toda da tela e "corta" as sobras (slice), então as figuras ficam grandes nos lados.
 */
const W = 1600;
/** Altura das cenas largas (faixas e destaque). */
const H = 560;
/** Altura das cenas altas: grades de 4 linhas e o grupo grátis + ofertas. */
const TALL = 1400;

/** Estrela de 5 pontas centrada em (cx, cy). */
function star(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  });
  return `M${points.join('L')}Z`;
}

/** Cupom picotado: retângulo com dois furos na altura do picote. */
function Ticket({ x, y, w, h, rotate }: { x: number; y: number; w: number; h: number; rotate: number }) {
  const cut = w * 0.3;
  const r = h * 0.12;
  const d = `M0,0 H${cut - r} A${r},${r} 0 0 0 ${cut + r},0 H${w} V${h} H${cut + r} A${r},${r} 0 0 0 ${cut - r},${h} H0 Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${w / 2} ${h / 2})`}>
      <path d={d} />
      <line x1={cut} y1={r + 6} x2={cut} y2={h - r - 6} strokeDasharray="6 7" />
      <line x1={cut + 28} y1={h * 0.38} x2={w - 28} y2={h * 0.38} />
      <line x1={cut + 28} y1={h * 0.62} x2={w * 0.72} y2={h * 0.62} />
    </g>
  );
}

/** Caixa de presente com laço. */
function Gift({ x, y, s, rotate }: { x: number; y: number; s: number; rotate: number }) {
  const lid = s * 0.24;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${s / 2} ${s / 2})`}>
      <rect x={s * 0.06} y={lid} width={s * 0.88} height={s - lid} rx={4} />
      <rect x={0} y={lid * 0.35} width={s} height={lid * 0.75} rx={4} />
      <line x1={s / 2} y1={lid * 0.35} x2={s / 2} y2={s} />
      <path d={`M${s / 2},${lid * 0.35} C${s * 0.3},${-lid * 0.9} ${s * 0.08},${lid * 0.2} ${s / 2},${lid * 0.35}`} />
      <path d={`M${s / 2},${lid * 0.35} C${s * 0.7},${-lid * 0.9} ${s * 0.92},${lid * 0.2} ${s / 2},${lid * 0.35}`} />
    </g>
  );
}

/** Etiqueta de preço com furo e o desconto escrito em contorno. */
function Tag({ x, y, w, rotate, text }: { x: number; y: number; w: number; rotate: number; text: string }) {
  const h = w * 0.5;
  const tip = h * 0.5;
  const d = `M0,0 H${w - tip} L${w},${h / 2} L${w - tip},${h} H0 Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${w / 2} ${h / 2})`}>
      <path d={d} strokeLinejoin="round" />
      <circle cx={w - tip * 0.95} cy={h / 2} r={h * 0.09} />
      <text x={w * 0.08} y={h * 0.7} fontSize={h * 0.55}>
        {text}
      </text>
    </g>
  );
}

/** Controle de videogame simplificado. */
function Gamepad({ x, y, s, rotate }: { x: number; y: number; s: number; rotate: number }) {
  const h = s * 0.62;
  const body = `M${s * 0.22},${h * 0.08} H${s * 0.78} C${s * 0.95},${h * 0.08} ${s},${h * 0.5} ${s * 0.98},${h * 0.82} C${s * 0.96},${h * 1.05} ${s * 0.78},${h * 1.02} ${s * 0.7},${h * 0.8} L${s * 0.64},${h * 0.66} H${s * 0.36} L${s * 0.3},${h * 0.8} C${s * 0.22},${h * 1.02} ${s * 0.04},${h * 1.05} ${s * 0.02},${h * 0.82} C0,${h * 0.5} ${s * 0.05},${h * 0.08} ${s * 0.22},${h * 0.08} Z`;
  const cx = s * 0.26;
  const cy = h * 0.42;
  const a = s * 0.07;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${s / 2} ${h / 2})`}>
      <path d={body} strokeLinejoin="round" />
      <path d={`M${cx - a},${cy} H${cx + a} M${cx},${cy - a} V${cy + a}`} />
      <circle cx={s * 0.72} cy={h * 0.33} r={s * 0.032} />
      <circle cx={s * 0.8} cy={h * 0.47} r={s * 0.032} />
      <circle cx={s * 0.64} cy={h * 0.47} r={s * 0.032} />
    </g>
  );
}

function Calendar() {
  // Grade inclinada de 7 colunas, com o número do dia no canto de cada célula (como na Steam).
  const cell = 150;
  const cols = 12;
  const rows = 5;
  const x0 = -160;
  const y0 = -60;
  const lines: ReactNode[] = [];
  for (let c = 0; c <= cols; c++) {
    lines.push(<line key={`v${c}`} x1={x0 + c * cell} y1={y0} x2={x0 + c * cell} y2={y0 + rows * cell} />);
  }
  for (let r = 0; r <= rows; r++) {
    lines.push(<line key={`h${r}`} x1={x0} y1={y0 + r * cell} x2={x0 + cols * cell} y2={y0 + r * cell} />);
  }
  const days: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const day = ((r * 7 + c + 3) % 30) + 1;
      days.push(
        <text key={`d${r}-${c}`} x={x0 + c * cell + 14} y={y0 + r * cell + 40} fontSize={30} stroke="none" fill="currentColor">
          {day}
        </text>,
      );
    }
  }
  return (
    <g transform={`rotate(-7 ${W / 2} ${H / 2}) skewX(-6)`}>
      {lines}
      {days}
    </g>
  );
}

function Charts() {
  // Duas linhas de tendência subindo, uma em cima e outra embaixo, e estrelas de avaliação.
  const trends = [
    [[-20, 520], [200, 470], [360, 500], [560, 390], [760, 420], [960, 300], [1160, 330], [1380, 200], [1640, 140]],
    [[-20, 1260], [220, 1210], [420, 1240], [640, 1120], [860, 1150], [1060, 1030], [1260, 1060], [1460, 930], [1640, 880]],
  ];
  return (
    <>
      {[180, 360, 540, 720, 900, 1080, 1260].map((y) => (
        <line key={y} x1={0} y1={y} x2={W} y2={y} strokeDasharray="2 12" />
      ))}
      {trends.map((trend, t) => (
        <g key={t}>
          <polyline points={trend.map((p) => p.join(',')).join(' ')} strokeLinejoin="round" />
          {trend.slice(1, -1).map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={7} />
          ))}
        </g>
      ))}
      {[
        [130, 170, 52],
        [1480, 470, 64],
        [1250, 110, 30],
        [330, 760, 40],
        [1380, 760, 34],
        [700, 640, 22],
        [160, 1060, 60],
        [1490, 1180, 46],
        [900, 1330, 28],
      ].map(([x, y, r]) => (
        <path key={`${x}-${y}`} d={star(x!, y!, r!)} strokeLinejoin="round" />
      ))}
    </>
  );
}

function Podium() {
  const steps = [
    { x: 1080, h: 230, n: '2' },
    { x: 1250, h: 320, n: '1' },
    { x: 1420, h: 170, n: '3' },
  ];
  return (
    <>
      {steps.map((s) => (
        <g key={s.n}>
          <rect x={s.x} y={H - s.h} width={160} height={s.h + 10} />
          <text x={s.x + 52} y={H - s.h + 90} fontSize={80}>
            {s.n}
          </text>
        </g>
      ))}
      <path d={star(1330, 150, 52)} strokeLinejoin="round" />
      <path d={star(1160, 250, 28)} strokeLinejoin="round" />
      <path d={star(1500, 300, 30)} strokeLinejoin="round" />
      <path d={star(820, 90, 22)} strokeLinejoin="round" />
      <path d={star(620, 210, 16)} strokeLinejoin="round" />
    </>
  );
}

/** Ampulheta. */
function Hourglass({ x, y, s, rotate }: { x: number; y: number; s: number; rotate: number }) {
  const w = s * 0.58;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${w / 2} ${s / 2})`}>
      <path
        d={`M0,0 H${w} M0,${s} H${w} M${w * 0.1},0 C${w * 0.1},${s * 0.37} ${w * 0.9},${s * 0.47} ${w * 0.9},${s * 0.5} C${w * 0.9},${s * 0.53} ${w * 0.1},${s * 0.63} ${w * 0.1},${s} M${w * 0.9},0 C${w * 0.9},${s * 0.37} ${w * 0.1},${s * 0.47} ${w * 0.1},${s * 0.5} C${w * 0.1},${s * 0.53} ${w * 0.9},${s * 0.63} ${w * 0.9},${s}`}
      />
    </g>
  );
}

/** Botão de play num círculo. */
function Play({ x, y, r, rotate }: { x: number; y: number; r: number; rotate: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <circle cx={0} cy={0} r={r} />
      <path d={`M${-r * 0.22},${-r * 0.42} L${r * 0.48},0 L${-r * 0.22},${r * 0.42} Z`} strokeLinejoin="round" />
    </g>
  );
}

interface Scene {
  /** Altura do viewBox (a largura é sempre W). */
  height: number;
  render: () => ReactNode;
}

const SCENES: Record<ArtKind, Scene> = {
  // Grátis + ofertas, numa ilustração só que cobre as duas seções: presentes e cupons (verde do
  // grátis) misturados com etiquetas e "%" (verde das ofertas).
  offers: {
    height: 800,
    render: () => (
      <>
        <g style={{ color: 'var(--accent-free)' }}>
          <Gift x={60} y={40} s={150} rotate={-12} />
          <Ticket x={640} y={30} w={260} h={100} rotate={-6} />
          <Gift x={1420} y={170} s={150} rotate={14} />
          <Ticket x={40} y={520} w={240} h={100} rotate={10} />
          <Gift x={760} y={690} s={100} rotate={-8} />
        </g>
        <g style={{ color: 'var(--accent-deal)' }}>
          <Tag x={240} y={250} w={230} rotate={-14} text="−85%" />
          <Tag x={640} y={345} w={220} rotate={8} text="−70%" />
          <Tag x={1180} y={330} w={280} rotate={12} text="−99%" />
          <text x={1100} y={120} fontSize={110} transform="rotate(-6 1130 90)">
            %
          </text>
          <text x={1380} y={770} fontSize={220} transform="rotate(-8 1440 700)">
            %
          </text>
        </g>
      </>
    ),
  },
  calendar: { height: H, render: Calendar },
  // Espalhados pela área toda (a grade é alta), não só no meio, para aparecerem nos vãos.
  controls: {
    height: TALL,
    render: () => (
      <>
        <Gamepad x={20} y={110} s={270} rotate={-12} />
        <Gamepad x={600} y={40} s={230} rotate={-8} />
        <Hourglass x={990} y={20} s={150} rotate={10} />
        <Play x={1180} y={330} r={70} rotate={8} />
        <Gamepad x={1290} y={70} s={260} rotate={12} />
        <Play x={260} y={600} r={66} rotate={-6} />
        <Gamepad x={640} y={560} s={300} rotate={-6} />
        <Hourglass x={1420} y={560} s={190} rotate={12} />
        <Gamepad x={40} y={980} s={240} rotate={10} />
        <Hourglass x={820} y={1080} s={160} rotate={-14} />
        <Play x={1180} y={1000} r={72} rotate={4} />
        <Gamepad x={1300} y={1140} s={250} rotate={-14} />
        <Play x={560} y={1290} r={50} rotate={0} />
      </>
    ),
  },
  charts: { height: TALL, render: Charts },
  podium: { height: H, render: Podium },
};

/**
 * Fundo ilustrado de uma seção: ocupa a largura da tela atrás dela e some nas bordas de cima
 * e de baixo. Vai dentro de um elemento com `relative isolate`; a cor vem de --accent.
 */
export function SectionArt({ kind, className = '' }: { kind: ArtKind; className?: string }) {
  const scene = SCENES[kind];
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${scene.height}`}
      preserveAspectRatio="xMidYMid slice"
      className={`section-art pointer-events-none absolute left-1/2 -z-10 w-screen -translate-x-1/2 ${className || '-top-20 h-[calc(100%+8rem)]'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      {scene.render()}
    </svg>
  );
}
