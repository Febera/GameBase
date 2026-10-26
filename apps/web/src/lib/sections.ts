import type { AdultMode, ListSort, NewGamesCategory, Page } from '@rj/shared';
import { api, DEFAULT_ORDER, type ListOrder } from './apiClient';
import { type CardModel, dealToCard, gameToCard, giveawayToCard } from './cards';

/** Uma lista da home: carrossel ou grade na página inicial, e página própria com a lista completa. */
export interface SectionDef {
  slug: string;
  title: string;
  /** Cor de destaque (variável CSS) que identifica o tipo de lista. */
  accent: string;
  /** Carrossel horizontal (25 jogos) ou grade de 5 × 4 (20 jogos). */
  layout: 'carousel' | 'grid';
  emptyMessage: string;
  /** Ordenações oferecidas na lista completa (a primeira é a padrão). */
  sorts: ListSort[];
  fetchPage: (offset: number, limit: number, adult: AdultMode, order?: ListOrder) => Promise<Page<CardModel>>;
}

/** Ordenação padrão de todas as listas (e a única da home). */
export { DEFAULT_ORDER };

function mapPage<T>(page: Page<T>, toCard: (item: T) => CardModel): Page<CardModel> {
  return { ...page, items: page.items.map(toCard) };
}

function newGames(category: NewGamesCategory) {
  return async (offset: number, limit: number, adult: AdultMode, order?: ListOrder) =>
    mapPage(await api.newPopular(offset, limit, adult, category, order), gameToCard);
}

const GAME_SORTS: ListSort[] = ['reviews', 'discount', 'release'];

/** Ordem da home. */
export const SECTIONS: SectionDef[] = [
  {
    slug: 'gratis',
    title: 'Grátis por tempo limitado',
    accent: 'var(--accent-free)',
    layout: 'carousel',
    emptyMessage: 'Nenhum jogo de PC está sendo dado de graça agora. Volte em alguns dias.',
    // Todos estão a 100%: no lugar de "desconto", o valor original.
    sorts: ['reviews', 'value', 'release'],
    fetchPage: async (offset, limit, adult, order) =>
      mapPage(await api.giveaways(offset, limit, adult, order), giveawayToCard),
  },
  {
    slug: 'ofertas',
    title: 'Grandes ofertas',
    accent: 'var(--accent-deal)',
    layout: 'carousel',
    emptyMessage: 'Nenhum jogo com 70% ou mais de desconto agora.',
    sorts: GAME_SORTS,
    fetchPage: async (offset, limit, adult, order) => mapPage(await api.deals(offset, limit, adult, order), dealToCard),
  },
  {
    slug: 'novos-gratis',
    title: 'Novos populares grátis',
    accent: 'var(--accent-new)',
    layout: 'grid',
    emptyMessage: 'Nenhum jogo gratuito popular foi lançado nos últimos 90 dias.',
    sorts: GAME_SORTS,
    fetchPage: newGames('free'),
  },
  {
    slug: 'novos-com-demo',
    title: 'Novos populares com demo',
    accent: 'var(--accent-demo)',
    layout: 'grid',
    emptyMessage: 'Nenhum jogo popular dos últimos 90 dias tem demo na Steam.',
    sorts: GAME_SORTS,
    fetchPage: newGames('demo'),
  },
  {
    slug: 'novos-pagos',
    title: 'Novos populares pagos',
    accent: 'var(--accent-paid)',
    layout: 'grid',
    emptyMessage: 'Nenhum jogo pago popular foi lançado nos últimos 90 dias.',
    sorts: GAME_SORTS,
    fetchPage: newGames('paid'),
  },
];

export function findSection(slug: string | undefined): SectionDef | undefined {
  return SECTIONS.find((section) => section.slug === slug);
}

/** Quantos itens cada formato mostra na home. */
export const PREVIEW_SIZE: Record<SectionDef['layout'], number> = { carousel: 25, grid: 20 };
/** Quantidade de jogos por página na lista completa. */
export const PAGE_SIZE = 24;
