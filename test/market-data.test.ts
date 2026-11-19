import { describe, expect, it } from 'vitest';
import dataset from '../public/data/markets.json';

describe('generated market dataset', () => {
  it('contains the OIC scope with 16 focus markets', () => {
    expect(dataset.countries).toHaveLength(57);
    expect(dataset.countries.filter((market) => market.focus)).toHaveLength(16);
    expect(dataset.meta.marketCount).toBe(57);
  });

  it('keeps missing values null instead of zero', () => {
    const suriname = dataset.countries.find((market) => market.iso3 === 'SUR');
    expect(suriname).toBeDefined();
    expect(suriname?.metrics.householdConsumption).toBeNull();
  });

  it('only exposes verified official Muslim population snapshots', () => {
    const official = dataset.countries.filter((market) => market.muslim.status === 'official');
    expect(official).toHaveLength(6);
    expect(official.every((market) => market.muslim.share != null)).toBe(true);
  });

  it('gives every market a China trade flow for 2025', () => {
    for (const market of dataset.countries) {
      expect(market.chinaTrade?.year).toBe('2025');
      expect(market.chinaTrade?.exports).not.toBeNull();
      expect(market.chinaTrade?.imports).not.toBeNull();
    }
  });

  it('limits representative products to Indonesia and Malaysia', () => {
    const withProducts = dataset.countries.filter((market) => market.products.length > 0);
    expect(withProducts.map((market) => market.iso3).sort()).toEqual(['IDN', 'MYS']);
  });

  it('pins source hashes and maps every visual field to a source column', () => {
    expect(Object.keys(dataset.meta.sourceFiles)).toHaveLength(9);
    expect(dataset.meta.fieldSources['metrics.population']?.valueField).toBe('总人口_人');
    expect(dataset.meta.fieldSources['chinaTrade.exports.cagr2020_2025']).toBeDefined();
    expect(dataset.meta.fieldSources['muslim.share']).toBeDefined();
    for (const market of dataset.countries) {
      expect(market.sourceRow.scope).toContain(market.iso3);
      expect(market.sourceRow.metrics).toContain(market.iso3);
      expect(market.sourceRow.trade).toContain(market.iso3);
    }
  });
});
