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
  allowRendererSwitch: boolean;
  globe: {
    textureUrl: string;
    bumpTextureUrl: string | null;
    initialView: InitialView;
    autoRotate: boolean;
    autoRotateSpeed: number;
    atmosphereColor: string;
  };
  data: {
    factsUrl: string;
    marketUrl: string;
  };
}

/** Prefix a public-file path with Vite's configured base (GitHub Pages-safe). */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const siteConfig: SiteConfig = {
  name: 'Global Muslim Markets',
  tagline: '3D 国家与市场探索器',
  cardRenderer: 'overview',
  allowRendererSwitch: true,
  globe: {
    textureUrl: publicAsset('textures/earth-night.jpg'),
    bumpTextureUrl: publicAsset('textures/earth-topology.png'),
    initialView: { lat: 22, lng: 68, altitude: 2.05 },
    autoRotate: true,
    autoRotateSpeed: 0.32,
    atmosphereColor: '#5fd6c2',
  },
  data: {
    factsUrl: publicAsset('data/country-facts.json'),
    marketUrl: publicAsset('data/market-profiles.json'),
  },
};
