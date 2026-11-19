import { describe, expect, it } from 'vitest';
import { createMarketIndex } from '../src/data/MarketRepository';
import type { MarketCountry, MarketDataset } from '../src/data/types';
import type { CountryShape } from '../src/globe/types';

const emptyMetrics = {
  population: null,
  populationGrowth: null,
  urbanShare: null,
  youthShare: null,
  workingAgeShare: null,
  seniorShare: null,
  gdp: null,
  gdpPerCapita: null,
  gniPerCapita: null,
  householdConsumption: null,
  householdConsumptionPerCapita: null,
  internetPenetration: null,
  goodsExports: null,
  goodsImports: null,
};

const market = (overrides: Partial<MarketCountry>): MarketCountry => ({
  id: '004',
  unM49: '004',
  iso3: 'AFG',
  nameZh: '阿富汗',
  nameEn: 'Afghanistan',
  flag: '🇦🇫',
  focus: false,
  metrics: emptyMetrics,
  muslim: {
    status: 'unavailable',
    share: null,
    population: null,
    year: null,
    source: null,
    note: null,
  },
  chinaTrade: null,
  products: [],
  sourceRow: {
    scope: 'scope.csv#AFG',
    metrics: 'market-latest.csv#AFG',
    trade: 'china-trade-yearly.csv#AFG/X,M/2025',
    cagr: 'china-trade-cagr.csv#AFG/X,M',
    muslim: 'muslim-official.csv#AFG',
  },
  ...overrides,
});

const dataset: MarketDataset = {
  meta: {
    generatedAt: '2026-11-19',
    dataUpdated: '2026-11',
    scope: 'OIC 57 国固定研究样本',
    focusCount: 1,
    marketCount: 2,
    officialMuslimCount: 0,
    sourceFiles: {},
    fieldSources: {},
    notes: [],
    sources: [],
  },
  countries: [
    market({
      id: '360',
      unM49: '360',
      iso3: 'IDN',
      nameZh: '印度尼西亚',
      nameEn: 'Indonesia',
      focus: true,
      metrics: {
        ...emptyMetrics,
        population: { value: 285721236, year: '2025' },
      },
    }),
    market({ id: '004', unM49: '004', iso3: 'AFG', nameZh: '阿富汗' }),
  ],
};

function shape(id: string, name: string): CountryShape {
  return {
    id,
    name,
    feature: {
      type: 'Feature',
      properties: { name },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    centroid: { lat: 0, lng: 0 },
    bounds: [
      [0, 0],
      [0, 0],
    ],
  };
}

describe('createMarketIndex', () => {
  const resolve = createMarketIndex(dataset);

  it('resolves a globe shape by UN M49 id', () => {
    const result = resolve(shape('360', 'Indonesia'));
    expect(result?.nameZh).toBe('印度尼西亚');
    expect(result?.focus).toBe(true);
    expect(result?.metrics.population?.value).toBe(285721236);
  });

  it('falls back to ISO3 and English name', () => {
    expect(resolve(shape('004', 'Afghanistan'))?.nameZh).toBe('阿富汗');
    expect(resolve(shape('name:afghanistan', 'Afghanistan'))?.iso3).toBe('AFG');
  });

  it('returns null for a country outside the market scope', () => {
    expect(resolve(shape('156', 'China'))).toBeNull();
  });
});
