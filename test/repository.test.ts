import { describe, expect, it } from 'vitest';
import { createCountryResolver } from '../src/data/CountryRepository';
import type { CountryFactsFile, MarketProfileFile } from '../src/data/types';
import type { CountryShape } from '../src/globe/types';

const facts: CountryFactsFile = {
  countries: {
    '360': {
      name: 'Indonesia',
      nameZh: '印度尼西亚',
      iso2: 'ID',
      iso3: 'IDN',
      capital: 'Jakarta',
      region: 'Asia',
      subregion: 'South-Eastern Asia',
      area: 1904569,
      flag: '🇮🇩',
    },
    UNK: {
      name: 'Kosovo',
      nameZh: '科索沃',
      iso2: 'XK',
      iso3: 'UNK',
      capital: 'Pristina',
      region: 'Europe',
      subregion: 'Southeast Europe',
      area: 10908,
      flag: '🇽🇰',
    },
  },
};

const market: MarketProfileFile = {
  meta: { demo: true, notice: '示例数据', updated: '2026-11' },
  countries: {
    '360': {
      headline: '测试档案',
      sectors: ['食品'],
      scores: { marketSize: 4.2 },
    },
    UNK: { headline: '科索沃测试档案' },
  },
};

const resolver = createCountryResolver(facts, market);

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

describe('createCountryResolver', () => {
  it('merges atlas shape, facts, and market profile into one view model', () => {
    const detail = resolver(shape('360', 'Indonesia'));

    expect(detail.label).toBe('印度尼西亚');
    expect(detail.name).toBe('Indonesia');
    expect(detail.iso2).toBe('ID');
    expect(detail.capital).toBe('Jakarta');
    expect(detail.market?.headline).toBe('测试档案');
    expect(detail.marketMeta.demo).toBe(true);
    expect(detail.marketMeta.notice).toBe('示例数据');
    expect(detail.hasFacts).toBe(true);
  });

  it('matches facts by English name when the atlas has no ISO id', () => {
    const detail = resolver(shape('name:kosovo', 'Kosovo'));
    expect(detail.label).toBe('科索沃');
    expect(detail.iso3).toBe('UNK');
    expect(detail.market?.headline).toBe('科索沃测试档案');
  });

  it('returns a safe fallback when nothing matches', () => {
    const detail = resolver(shape('name:atlantis', 'Atlantis'));
    expect(detail.label).toBe('Atlantis');
    expect(detail.hasFacts).toBe(false);
    expect(detail.market).toBeNull();
    expect(detail.marketMeta.available).toBe(true);
  });

  it('tolerates missing datasets', () => {
    const empty = createCountryResolver(null, null);
    const detail = empty(shape('250', 'France'));
    expect(detail.label).toBe('France');
    expect(detail.marketMeta.available).toBe(false);
    expect(detail.hasFacts).toBe(false);
  });

  it('indexes market profiles by ISO alpha-3 keys', () => {
    const alpha3Market: MarketProfileFile = {
      countries: { IDN: { headline: '按 ISO3 索引' } },
    };
    const resolve = createCountryResolver(facts, alpha3Market);
    expect(resolve(shape('360', 'Indonesia')).market?.headline).toBe('按 ISO3 索引');
  });
});
