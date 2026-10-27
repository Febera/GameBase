import type { CoverImage, DealCard, GameCard, GiveawayCard, Money } from '@rj/shared';

/** Tudo o que um card precisa para ser desenhado, venha de qual fonte vier. */
export interface CardModel {
  key: string;
  title: string;
  href: string;
  /** Link para fora do site (loja, giveaway): abre em nova aba. */
  external: boolean;
  cover: CoverImage | null;
  /** Imagem alternativa quando não há capa da IGDB. */
  fallbackImage: string | null;
  /** Etiqueta no canto superior esquerdo, como "−85%". */
  badge?: string;
  /** Linha de preço sob o nome. */
  price?: { current: string; previous?: string | undefined };
  /** Linha discreta sob o nome, como a loja. */
  note?: string;
  /** Descrição completa para leitores de tela. */
  label: string;
  /** Fim da promoção ou do giveaway (AAAA-MM-DD ou ISO 8601), quando informado. */
  endsAt?: string | null;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney({ amount, currency }: Money): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

/** "2026-10-30" → "30/10" */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}`;
}

export function gameToCard(game: GameCard): CardModel {
  const card: CardModel = {
    key: `game-${game.id}`,
    title: game.name,
    href: `/jogo/${game.id}`,
    external: false,
    cover: game.cover,
    fallbackImage: null,
    label: game.name,
  };
  if (game.free) {
    card.price = { current: 'Grátis' };
    card.label = `${game.name}, grátis`;
  } else if (game.price) {
    const current = formatMoney(game.price.current);
    const onSale = game.price.cut > 0;
    card.price = { current, previous: onSale ? formatMoney(game.price.regular) : undefined };
    if (onSale) card.badge = `−${game.price.cut}%`;
    card.label = onSale
      ? `${game.name}, ${game.price.cut}% de desconto: de ${formatMoney(game.price.regular)} por ${current}`
      : `${game.name}, ${current}`;
  }
  return card;
}

export function giveawayToCard(giveaway: GiveawayCard): CardModel {
  const until = giveaway.endDate ? ` até ${formatDayMonth(giveaway.endDate)}` : '';
  const previous = giveaway.regular ? formatMoney(giveaway.regular) : (giveaway.worth ?? undefined);
  return {
    key: `giveaway-${giveaway.id}`,
    title: giveaway.title,
    // Abre a página do GameBase (o resgate fica lá); só sem página nenhuma vai direto para a loja.
    href: giveaway.igdbId ? `/jogo/${giveaway.igdbId}` : giveaway.itadId ? `/oferta/${giveaway.itadId}` : giveaway.url,
    external: !giveaway.igdbId && !giveaway.itadId,
    cover: giveaway.cover,
    fallbackImage: giveaway.image,
    badge: `Grátis${until}`,
    price: previous ? { current: 'Grátis', previous } : undefined,
    note: giveaway.store,
    label: `${giveaway.title}, grátis${until} na ${giveaway.store}`,
    endsAt: giveaway.endDate,
  };
}

export function dealToCard(deal: DealCard): CardModel {
  const current = formatMoney(deal.price);
  const previous = formatMoney(deal.regular);
  return {
    key: `deal-${deal.id}`,
    title: deal.title,
    // Jogo conhecido na IGDB abre a página completa; os demais, a página da oferta.
    href: deal.igdbId ? `/jogo/${deal.igdbId}` : `/oferta/${deal.id}`,
    external: false,
    cover: deal.cover,
    fallbackImage: deal.boxart,
    badge: `−${deal.cut}%`,
    price: { current, previous },
    note: deal.shop,
    label: `${deal.title}, ${deal.cut}% de desconto: de ${previous} por ${current} na ${deal.shop}`,
    endsAt: deal.expiry,
  };
}

/** Dias inteiros entre hoje e a data, pelo calendário local (hoje = 0). */
function daysUntil(isoDate: string, now: Date): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const end = new Date(y!, m! - 1, d!);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Prazo em texto curto: "Acaba hoje", "Acaba amanhã", "Acaba em 3 dias" (até uma semana) ou
 * "Até 30/10". Sem data, ou com data já passada, devolve null.
 */
export function endsLabel(isoDate: string | null | undefined, now = new Date()): string | null {
  if (!isoDate) return null;
  const days = daysUntil(isoDate, now);
  if (days < 0) return null;
  if (days === 0) return 'Acaba hoje';
  if (days === 1) return 'Acaba amanhã';
  if (days <= 6) return `Acaba em ${days} dias`;
  return `Até ${formatDayMonth(isoDate)}`;
}

/** true quando o prazo termina nos próximos 7 dias (hoje incluído). */
export function endsSoon(isoDate: string | null | undefined, now = new Date()): boolean {
  if (!isoDate) return false;
  const days = daysUntil(isoDate, now);
  return days >= 0 && days <= 6;
}
