import { describe, expect, it } from 'vitest';
import { dealToCard, formatDayMonth, formatMoney, gameToCard, giveawayToCard } from './cards';

describe('cards', () => {
  it('formata reais no padrão brasileiro', () => {
    expect(formatMoney({ amount: 7.49, currency: 'BRL' }).replace(/\s/g, ' ')).toBe('R$ 7,49');
  });

  it('formata dia e mês', () => {
    expect(formatDayMonth('2026-10-30')).toBe('30/10');
  });

  it('monta o card de oferta com desconto, preços e loja', () => {
    const card = dealToCard({
      id: 'x',
      title: 'Celeste',
      cover: null,
      boxart: 'box.jpg',
      igdbId: null,
      shop: 'Steam',
      price: { amount: 9.99, currency: 'BRL' },
      regular: { amount: 49.99, currency: 'BRL' },
      cut: 80,
      rating: null,
      releaseDate: null,
      reviewCount: null,
      expiry: null,
      url: 'https://itad.link/x',
    });
    expect(card).toMatchObject({ badge: '−80%', note: 'Steam', external: false, href: '/oferta/x', fallbackImage: 'box.jpg' });
    expect(card.label).toContain('80% de desconto');
  });

  it('mostra a data de fim do giveaway quando existe', () => {
    const base = {
      id: 'gp-1',
      title: 'Tunic',
      cover: null,
      image: null,
      igdbId: null,
      itadId: null,
      releaseDate: null,
      reviewCount: null,
      regular: null,
      worth: null,
      store: 'Epic Games Store',
      url: 'https://x',
    };
    expect(giveawayToCard({ ...base, endDate: '2026-11-02' }).badge).toBe('Grátis até 02/11');
    expect(giveawayToCard({ ...base, endDate: null }).badge).toBe('Grátis');
  });

  it('mostra o preço original riscado nos jogos que ficaram grátis', () => {
    const card = giveawayToCard({
      id: 'itad-1',
      title: 'Grande Jogo',
      cover: null,
      image: null,
      igdbId: null,
      itadId: 'abc',
      releaseDate: null,
      reviewCount: null,
      regular: { amount: 199.9, currency: 'BRL' },
      worth: null,
      endDate: null,
      store: 'Steam',
      url: 'https://x',
    });
    expect(card.price?.current).toBe('Grátis');
    expect(card.price?.previous?.replace(/\s/g, ' ')).toBe('R$ 199,90');
    // Com ID da ITAD, abre a página da oferta dentro do GameBase.
    expect(card).toMatchObject({ href: '/oferta/abc', external: false });
  });

  it('mostra preço, desconto ou "Grátis" nos novos populares', () => {
    const base = { id: 1, name: 'X', slug: 'x', cover: null, releaseDate: null, rating: null };
    expect(gameToCard({ ...base, free: true, price: null }).price).toEqual({ current: 'Grátis' });

    const paid = gameToCard({
      ...base,
      free: false,
      price: { current: { amount: 59.9, currency: 'BRL' }, regular: { amount: 59.9, currency: 'BRL' }, cut: 0 },
    });
    expect(paid.badge).toBeUndefined();
    expect(paid.price?.previous).toBeUndefined();

    const sale = gameToCard({
      ...base,
      free: false,
      price: { current: { amount: 29.95, currency: 'BRL' }, regular: { amount: 59.9, currency: 'BRL' }, cut: 50 },
    });
    expect(sale.badge).toBe('−50%');
    expect(sale.price?.previous).toBeDefined();
  });
});
