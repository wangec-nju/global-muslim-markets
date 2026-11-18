export interface CountryFacts {
  name?: string;
  nameZh?: string;
  iso2?: string;
  iso3?: string;
  capital?: string;
  region?: string;
  subregion?: string;
  area?: number;
  flag?: string;
  unMember?: boolean;
}

export interface CountryFactsFile {
  meta?: {
    source?: string;
    generator?: string;
    count?: number;
  };
  countries: Record<string, CountryFacts>;
}

export interface MarketScores {
  marketSize?: number;
  accessibility?: number;
  growthMomentum?: number;
}

export interface MarketProfile {
  headline?: string;
  summary?: string;
  sectors?: string[];
  tags?: string[];
  scores?: MarketScores;
  updated?: string;
}

export interface MarketMeta {
  demo: boolean;
  notice: string | null;
  updated: string | null;
  available: boolean;
}

export interface MarketProfileFile {
  meta?: {
    demo?: boolean;
    notice?: string;
    updated?: string;
  };
  countries: Record<string, MarketProfile>;
}

/**
 * The single view-model handed to card content renderers. Card shells and
 * renderers both depend on this type, never on raw datasets or the globe.
 */
export interface CountryDetail {
  id: string;
  /** English name, when available. */
  name: string;
  nameZh: string | null;
  /** Preferred human-readable label (Chinese when present). */
  label: string;
  iso2: string | null;
  iso3: string | null;
  capital: string | null;
  region: string | null;
  subregion: string | null;
  area: number | null;
  flag: string | null;
  market: MarketProfile | null;
  marketMeta: MarketMeta;
  hasFacts: boolean;
}
