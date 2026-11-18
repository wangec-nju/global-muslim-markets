import type { Feature, Geometry } from 'geojson';
import type { ScreenPoint } from '../shared/coords';

export interface CountryFeatureProperties {
  name?: string;
  [key: string]: unknown;
}

export type CountryFeature = Feature<Geometry, CountryFeatureProperties>;

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Geometry-level country record. Knows nothing about cards or market data. */
export interface CountryShape {
  /** Stable key. ISO numeric for the 110m atlas, `name:<slug>` for edge cases. */
  id: string;
  /** English label from the atlas. */
  name: string;
  feature: CountryFeature;
  /** Spherical centroid, used to fly the camera to a country. */
  centroid: GeoPoint;
  /** [[west, south], [east, north]] in degrees. */
  bounds: [[number, number], [number, number]];
}

export interface GlobeHoverEvent {
  country: CountryShape | null;
  point: ScreenPoint;
}

export interface GlobeCountryEvent {
  country: CountryShape;
  point: ScreenPoint;
}
