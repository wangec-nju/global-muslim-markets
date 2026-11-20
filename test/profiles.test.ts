import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import profiles from '../public/data/profiles.json';
import markets from '../public/data/markets.json';

describe('country profiles', () => {
  it('has a profile for every market plus China', () => {
    expect(profiles.profiles).toHaveLength(58);
    const byIso = new Map(profiles.profiles.map((profile) => [profile.iso3, profile]));
    expect(byIso.get('CHN')?.isChina).toBe(true);
    for (const market of markets.countries) {
      expect(byIso.has(market.iso3), market.iso3).toBe(true);
    }
  });

  it('keeps China as 34 province-level divisions including Taiwan Province', () => {
    const china = profiles.profiles.find((profile) => profile.iso3 === 'CHN');
    expect(china?.divisions).toHaveLength(34);
    expect(china?.divisions.some((division) => division.nameZh === '台湾')).toBe(true);
    expect(china?.cities.some((city) => city.nameZh === '台北')).toBe(true);
  });

  it('does not fabricate missing cities or HS2 data', () => {
    const withHs2 = profiles.profiles.filter((profile) => profile.hs2.length > 0);
    expect(withHs2.length).toBeGreaterThanOrEqual(45);
    for (const profile of withHs2) {
      expect(profile.hs2.every((row) => (row.valueUsd ?? 0) > 0)).toBe(true);
      expect(profile.hs2.length).toBeLessThanOrEqual(5);
    }
  });

  it('has local flag images and Chinese city labels for most cities', () => {
    const profilesWithFlags = profiles.profiles.filter((profile) => profile.flagUrl);
    expect(profilesWithFlags).toHaveLength(58);
    expect(profilesWithFlags.every((profile) => existsSync(`public/${profile.flagUrl}`))).toBe(true);
    const cities = profiles.profiles.flatMap((profile) => profile.cities);
    expect(cities.filter((city) => city.nameZh).length / cities.length).toBeGreaterThan(0.8);
  });

  it('pins the profile source files', () => {
    expect(Object.keys(profiles.meta.sourceFiles).length).toBeGreaterThanOrEqual(10);
    expect(profiles.meta.sources.some((source) => source.name === 'UN Comtrade')).toBe(true);
    for (const [file, expected] of Object.entries(profiles.meta.sourceFiles)) {
      const actual = createHash('sha256')
        .update(readFileSync(`data/source/${file}`))
        .digest('hex');
      expect(actual, file).toBe(expected);
    }
  });
});
