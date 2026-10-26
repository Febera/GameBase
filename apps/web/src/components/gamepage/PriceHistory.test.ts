import { describe, expect, it } from 'vitest';
import { isAtHistoricalLow, type PricingData } from './PriceHistory';

const brl = (amount: number) => ({ amount, currency: 'BRL' });
const base: PricingData = {
  name: 'X',
  offers: [{ shop: 'Nuuvem', price: brl(9.9), regular: brl(59.9), cut: 83, drm: [], url: 'https://x' }],
  steam: null,
  storeLinks: [],
  historyLow: { price: brl(9.9), shop: 'Nuuvem', date: '2025-01-01' },
  yearLow: null,
  giveaway: null,
};

describe('isAtHistoricalLow', () => {
  it('dourado quando o melhor preço de agora é igual ao menor da história', () => {
    expect(isAtHistoricalLow(base)).toBe(true);
    expect(isAtHistoricalLow({ ...base, historyLow: { ...base.historyLow!, price: brl(9.89) } })).toBe(false);
  });

  it('usa o preço da Steam quando não há ofertas, e ignora jogos grátis', () => {
    const steamOnly: PricingData = {
      ...base,
      offers: [],
      steam: { appId: 1, url: 'https://s', free: false, hasDemo: false, price: { current: brl(9.9), regular: brl(59.9), cut: 83 } },
    };
    expect(isAtHistoricalLow(steamOnly)).toBe(true);
    expect(isAtHistoricalLow({ ...base, offers: [], historyLow: { ...base.historyLow!, price: brl(0) } })).toBe(false);
  });
});
