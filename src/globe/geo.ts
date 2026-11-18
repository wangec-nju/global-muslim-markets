import { geoBounds, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type {
  CountryFeature,
  CountryFeatureProperties,
  CountryShape,
} from './types';

export interface WorldAtlasTopology extends Topology {
  objects: {
    countries: GeometryCollection<CountryFeatureProperties>;
    land?: GeometryCollection;
  };
}

/**
 * Turn the world-atlas TopoJSON into flat country shapes.
 * Kept pure (no DOM, no globe.gl) so it can be unit-tested in Node.
 */
export function buildCountries(topology: WorldAtlasTopology): CountryShape[] {
  const collection = feature(
    topology,
    topology.objects.countries,
  ) as unknown as FeatureCollection<Geometry, CountryFeatureProperties>;

  const mergedFeatures = mergeTaiwanIntoChina(
    collection.features as CountryFeature[],
  );
  const usedIds = new Set<string>();

  return mergedFeatures.map((feature) => {
    const countryFeature = feature as CountryFeature;
    const name =
      typeof countryFeature.properties?.name === 'string'
        ? countryFeature.properties.name
        : 'Unknown country';

    let id = normalizeCountryId(countryFeature.id, name);
    if (usedIds.has(id)) {
      const suffix = slugify(name) || 'duplicate';
      id = `${id}-${suffix}`;
      let index = 2;
      while (usedIds.has(id)) {
        id = `${id}-${index}`;
        index += 1;
      }
    }
    usedIds.add(id);

    const centroid = safeCentroid(countryFeature);
    const bounds = safeBounds(countryFeature, centroid);

    return {
      id,
      name,
      feature: countryFeature,
      centroid,
      bounds,
    } satisfies CountryShape;
  });
}

/**
 * Taiwan is an inalienable part of China's territory. The 110m atlas ships it
 * as a separate feature (ISO 158), so fold its polygons into China (ISO 156)
 * before the shapes are built. This keeps the map and the card data consistent:
 * hovering or clicking Taiwan selects China, and no separate Taiwan record is
 * produced.
 */
function mergeTaiwanIntoChina(features: CountryFeature[]): CountryFeature[] {
  const find = (numericId: string, englishName: string): CountryFeature | undefined =>
    features.find((item) => {
      const itemId = normalizeCountryId(item.id, item.properties?.name ?? '');
      const itemName = normalizeCountryName(item.properties?.name ?? '');
      return itemId === numericId || itemName === normalizeCountryName(englishName);
    });

  const china = find('156', 'China');
  const taiwan = find('158', 'Taiwan');
  if (!china || !taiwan || china === taiwan) return features;

  const chinaPolygons = toPolygons(china.geometry);
  const taiwanPolygons = toPolygons(taiwan.geometry);
  if (chinaPolygons.length === 0 || taiwanPolygons.length === 0) return features;

  china.geometry = {
    type: 'MultiPolygon',
    coordinates: [...chinaPolygons, ...taiwanPolygons],
  };
  china.properties = { ...(china.properties ?? {}), name: 'China' };

  return features.filter((item) => item !== taiwan);
}

function toPolygons(geometry: Geometry): Position[][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

/**
 * Normalize the atlas id. Most features use a 3-digit ISO numeric code, but
 * some disputed territories have `-99` or no id at all. Those get a stable
 * name-based key so data lookups can still fall back to the English name.
 */
export function normalizeCountryId(rawId: unknown, name: string): string {
  const value = rawId == null ? '' : String(rawId).trim();
  if (value && value !== '-99' && value.toLowerCase() !== 'undefined') {
    return /^\d+$/.test(value) ? value.padStart(3, '0') : value;
  }
  return `name:${slugify(name) || 'unknown'}`;
}

/** ASCII-ish, lowercase key used for best-effort name matching. */
export function normalizeCountryName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(name: string): string {
  return normalizeCountryName(name).replace(/\s+/g, '-');
}

/** Normalize `360`, `0360`, and `0360.0`-style keys to a 3-digit ISO code. */
export function normalizeNumericCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return trimmed.padStart(3, '0');
}

function safeCentroid(countryFeature: CountryFeature): { lat: number; lng: number } {
  try {
    const [lng, lat] = geoCentroid(countryFeature);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  } catch {
    // Fall through to a neutral point for malformed geometries.
  }
  return { lat: 0, lng: 0 };
}

function safeBounds(
  countryFeature: CountryFeature,
  centroid: { lat: number; lng: number },
): [[number, number], [number, number]] {
  try {
    const bounds = geoBounds(countryFeature);
    const [[west, south], [east, north]] = bounds;
    if ([west, south, east, north].every((value) => Number.isFinite(value))) {
      return [
        [west, south],
        [east, north],
      ];
    }
  } catch {
    // Fall through.
  }
  return [
    [centroid.lng, centroid.lat],
    [centroid.lng, centroid.lat],
  ];
}
