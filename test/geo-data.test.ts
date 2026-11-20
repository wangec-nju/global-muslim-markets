import { describe, expect, it } from 'vitest';
import admin from '../public/data/admin1-paths.json';
import sea from '../public/data/sea-routes.json';

describe('geographic overlays', () => {
  it('has admin-1 boundary paths for all markets and China', () => {
    expect(Object.keys(admin.countries)).toHaveLength(58);
    expect(admin.countries.CHN.length).toBeGreaterThan(0);
    for (const paths of Object.values(admin.countries)) {
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.every((path) => path.points.length >= 3)).toBe(true);
    }
  });

  it('has eight Chinese origin routes for every market', () => {
    expect(Object.keys(sea.routes)).toHaveLength(57);
    expect(sea.meta.origins).toHaveLength(8);
    let options = 0;
    for (const route of Object.values(sea.routes)) {
      expect(route.options).toHaveLength(8);
      for (const option of route.options) {
        options += 1;
        expect(option.points.length).toBeGreaterThan(1);
        expect(option.distanceKm).toBeGreaterThan(0);
        for (const [lat, lng] of option.points) {
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
          expect(lng).toBeGreaterThanOrEqual(-180);
          expect(lng).toBeLessThanOrEqual(180);
        }
      }
    }
    expect(options).toBe(456);
  });
});
