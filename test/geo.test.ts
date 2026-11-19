import { describe, expect, it } from 'vitest';
import { geoContains } from 'd3-geo';
import worldTopology from 'world-atlas/countries-50m.json';
import {
  buildCountries,
  normalizeCountryId,
  normalizeCountryName,
  normalizeNumericCode,
  type WorldAtlasTopology,
} from '../src/globe/geo';

describe('buildCountries', () => {
  const countries = buildCountries(worldTopology as unknown as WorldAtlasTopology);

  it('parses the world-atlas 110m topology', () => {
    expect(countries).toHaveLength(240);
    expect(new Set(countries.map((country) => country.id)).size).toBe(countries.length);
  });

  it('uses ISO numeric ids and computes usable centroids', () => {
    const indonesia = countries.find((country) => country.id === '360');
    expect(indonesia?.name).toBe('Indonesia');
    expect(indonesia?.centroid.lng).toBeGreaterThan(110);
    expect(indonesia?.centroid.lng).toBeLessThan(130);
    expect(indonesia?.centroid.lat).toBeGreaterThan(-12);
    expect(indonesia?.centroid.lat).toBeLessThan(6);
    expect(indonesia?.bounds[0][0]).toBeLessThan(indonesia?.bounds[1][0] ?? 0);
  });

  it('merges Taiwan into China as one country', () => {
    expect(countries.some((country) => country.id === '158' || country.name === 'Taiwan')).toBe(
      false,
    );

    const china = countries.find((country) => country.id === '156');
    expect(china).toBeDefined();
    expect(china?.name).toBe('China');
    // Mainland and Taiwan both resolve to the same China feature.
    expect(geoContains(china!.feature, [116.4, 39.9])).toBe(true);
    expect(geoContains(china!.feature, [121.0, 23.7])).toBe(true);
  });

  it('falls back to a stable name key for territories without an ISO id', () => {
    const kosovo = countries.find((country) => country.name === 'Kosovo');
    expect(kosovo?.id).toBe('name:kosovo');

    const northCyprus = countries.find((country) => country.name === 'N. Cyprus');
    expect(northCyprus?.id).toBe('name:n-cyprus');
  });

  it('keeps the original GeoJSON feature reference for globe rendering', () => {
    const france = countries.find((country) => country.name === 'France');
    expect(france?.feature.type).toBe('Feature');
    expect(france?.feature.properties?.name).toBe('France');
  });
});

describe('id and name normalization', () => {
  it('normalizes numeric ids', () => {
    expect(normalizeCountryId(8, 'Anguilla')).toBe('008');
    expect(normalizeCountryId('360', 'Indonesia')).toBe('360');
    expect(normalizeCountryId('-99', 'Kosovo')).toBe('name:kosovo');
    expect(normalizeCountryId(undefined, 'N. Cyprus')).toBe('name:n-cyprus');
    expect(normalizeNumericCode('50')).toBe('050');
    expect(normalizeNumericCode('ID')).toBeNull();
  });

  it('normalizes names for best-effort matching', () => {
    expect(normalizeCountryName("Côte d'Ivoire")).toBe('cote d ivoire');
    expect(normalizeCountryName('Bosnia and Herz.')).toBe('bosnia and herz');
    expect(normalizeCountryName('  ')).toBe('');
  });
});
