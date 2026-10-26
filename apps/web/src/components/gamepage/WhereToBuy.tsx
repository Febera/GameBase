import type { Money } from '@rj/shared';
import { ExternalLink, Gift, Timer } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatDayMonth, formatMoney } from '../../lib/cards';
import { PriceHistory, type PricingData } from './PriceHistory';

interface Row {
  key: string;
  shop: string;
  detail?: string;
  price?: Money;
  regular?: Money;
  cut?: number;
  free?: boolean;
  url: string;
  action: string;
}

/** Monta as linhas de compra, da melhor opção para a pior. */
function rowsOf(game: PricingData): Row[] {
  const steam = game.steam;
  const giveaway = game.giveaway;
  // De graça por tempo limitado: o resgate vem primeiro, acima das lojas.
  const giveawayRow: Row[] = giveaway
    ? [
        {
          key: 'giveaway',
          shop: giveaway.store,
          detail: giveaway.endDate ? `Grátis até ${formatDayMonth(giveaway.endDate)}` : 'Grátis por tempo limitado',
          regular: giveaway.regular ?? undefined,
          free: true,
          url: giveaway.url,
          action: 'Resgatar',
        },
      ]
    : [];
  return [...giveawayRow, ...storeRows(game)];
}

function storeRows(game: PricingData): Row[] {
  const steam = game.steam;
  if (steam?.free) {
    return [{ key: 'steam', shop: 'Steam', free: true, url: steam.url, action: 'Jogar' }];
  }
  if (game.offers.length) {
    return game.offers.map((o, i) => ({
      key: `${o.shop}-${i}`,
      shop: o.shop,
      detail: o.drm.length ? `Ativa em: ${o.drm.join(', ')}` : undefined,
      price: o.price,
      regular: o.regular,
      cut: o.cut,
      url: o.url,
      action: 'Comprar',
    }));
  }
  if (steam?.price) {
    return [
      {
        key: 'steam',
        shop: 'Steam',
        price: steam.price.current,
        regular: steam.price.regular,
        cut: steam.price.cut,
        url: steam.url,
        action: 'Comprar',
      },
    ];
  }
  const links = steam ? [{ store: 'Steam', url: steam.url }, ...game.storeLinks.filter((l) => l.store !== 'Steam')] : game.storeLinks;
  return links.map((l) => ({ key: l.store, shop: l.store, detail: 'Preço indisponível', url: l.url, action: 'Ver na loja' }));
}

/**
 * Bloco de compra logo abaixo da mídia: uma linha por loja, a melhor em destaque.
 * O histórico de preços fica encaixado em cima, como uma aba atrás deste bloco.
 */
export function WhereToBuy({ game }: { game: PricingData }) {
  const rows = rowsOf(game);
  const steam = game.steam;

  return (
    <div>
      <PriceHistory data={game} />
    <section aria-labelledby="onde-comprar" className="relative z-10 rounded-md border border-line bg-surface p-4 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.5)] md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="onde-comprar" className="font-display text-xl font-bold tracking-tight">
          {steam?.free ? 'Jogue de graça' : `Onde comprar ${game.name}`}
        </h2>
        {steam?.hasDemo && !steam.free && (
          <a
            href={steam.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-[var(--brand-a)] hover:underline"
          >
            <Timer className="size-4" aria-hidden />
            DEMO <span className="normal-case">Disponível</span>
            <span className="sr-only">na Steam (abre em nova aba)</span>
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma loja de PC encontrada para este jogo.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => {
            const best = i === 0 && (rows.length > 1 || row.free);
            return (
              <li
                key={row.key}
                className={[
                  'reveal flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md px-3 py-2.5 transition-colors duration-150',
                  best ? 'bg-surface-2 ring-1 ring-[var(--accent-deal)]' : 'bg-surface-2/60 hover:bg-surface-2',
                ].join(' ')}
                style={{ '--i': i } as CSSProperties}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {row.key === 'giveaway' && <Gift className="size-4 text-[var(--accent-free)]" aria-hidden />}
                    {row.shop}
                    {best && !row.free && row.key !== 'giveaway' && (
                      <span className="rounded bg-[var(--accent-deal)] px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--on-accent)]">
                        Menor preço
                      </span>
                    )}
                  </p>
                  {row.detail && <p className="truncate text-xs text-muted">{row.detail}</p>}
                </div>

                <div className="flex items-center gap-3">
                  {row.cut !== undefined && row.cut > 0 && (
                    <span className="rounded-md bg-[var(--accent-deal)] px-2 py-1 text-sm font-bold text-[var(--on-accent)] tabular-nums">
                      −{row.cut}%
                    </span>
                  )}
                  {(row.price || row.free) && (
                    <span className="text-right leading-tight tabular-nums">
                      {((row.cut !== undefined && row.cut > 0) || row.free) && row.regular && (
                        <s className="block text-xs text-muted">{formatMoney(row.regular)}</s>
                      )}
                      <span className="font-display text-lg font-bold">{row.free ? 'Grátis' : formatMoney(row.price!)}</span>
                    </span>
                  )}
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={[
                      'inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-black ring-1 ring-black/10 transition hover:bg-neutral-200',
                      best ? 'shadow-[0_0_0_2px_var(--accent-deal)]' : '',
                    ].join(' ')}
                  >
                    {row.action}
                    <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">na {row.shop} (abre em nova aba)</span>
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

    </section>
    </div>
  );
}

