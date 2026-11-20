import type { CardRendererId } from './card/registry';

export interface InitialView {
  lat: number;
  lng: number;
  altitude: number;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  cardRenderer: CardRendererId;
  globe: {
    textureUrl: string;
    bumpTextureUrl: string | null;
    initialView: InitialView;
    autoRotate: boolean;
    autoRotateSpeed: number;
    atmosphereColor: string;
  };
  data: {
    marketUrl: string;
    profileUrl: string;
  };
}

/** Prefix a public-file path with Vite's configured base (GitHub Pages-safe). */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const siteConfig: SiteConfig = {
  name: 'Global Muslim Markets',
  tagline: 'OIC 57 国市场探索器',
  cardRenderer: 'market',
  globe: {
    textureUrl: publicAsset('textures/earth-night.jpg'),
    bumpTextureUrl: publicAsset('textures/earth-topology.png'),
    initialView: { lat: 22, lng: 52, altitude: 2.0 },
    autoRotate: true,
    autoRotateSpeed: 0.3,
    atmosphereColor: '#5fd6c2',
  },
  data: {
    marketUrl: publicAsset('data/markets.json'),
    profileUrl: publicAsset('data/profiles.json'),
  },
};
