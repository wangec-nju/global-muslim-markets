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

export interface TradeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string | string[];
  width: number;
  /** Trade value in USD, used only for labels/tooltips. */
  value?: number;
}

export interface GlobeHub {
  lat: number;
  lng: number;
  type: 'airport' | 'port' | 'logistics';
  label: string;
}

export interface GlobeCountryEvent {
  country: CountryShape;
  point: ScreenPoint;
}
