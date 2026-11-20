import { describe, expect, it } from 'vitest';
import markets from '../public/data/markets.json';
import reference from '../public/data/muslim-reference.json';

describe('Muslim share reference', () => {
  it('has a Pew/Wikipedia reference for every OIC market', () => {
    const countries = reference.countries as Record<string, { display: string; year: number }>;
    expect(Object.keys(countries)).toHaveLength(57);
    for (const market of markets.countries) {
      const entry = countries[market.iso3];
      expect(entry, market.iso3).toBeDefined();
      if (!entry) continue;
      expect(entry.display.length).toBeGreaterThan(0);
      expect(entry.year).toBe(2010);
    }
  });

  it('keeps the six official census snapshots separate from the reference', () => {
    const official = markets.countries.filter((market) => market.muslim.status === 'official');
    expect(official).toHaveLength(6);
    expect(official.every((market) => market.muslim.share != null)).toBe(true);
  });
});
