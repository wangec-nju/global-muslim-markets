import type { CountryShape } from '../globe/types';
import { normalizeCountryName, normalizeNumericCode } from '../globe/geo';
import type {
  CountryDetail,
  CountryFacts,
  CountryFactsFile,
  MarketMeta,
  MarketProfile,
  MarketProfileFile,
} from './types';

export interface CountryDataUrls {
  factsUrl: string;
  marketUrl: string;
}

export interface DataLoadReport {
  factsLoaded: boolean;
  marketLoaded: boolean;
  errors: string[];
}

export type CountryResolver = (shape: CountryShape) => CountryDetail;

const EMPTY_FACTS: CountryFactsFile = { countries: {} };
const EMPTY_MARKET: MarketProfileFile = { countries: {} };

const DEFAULT_MARKET_META: MarketMeta = {
  demo: false,
  notice: null,
  updated: null,
  available: false,
};

/**
 * Loads both datasets once and exposes a synchronous shape -> detail mapping.
 * Failures are non-fatal: the globe must still render when a data file is
 * missing, so the resolver degrades to "no facts / no market profile".
 */
export class CountryRepository {
  private resolver: CountryResolver = createCountryResolver(null, null);
  private report: DataLoadReport = { factsLoaded: false, marketLoaded: false, errors: [] };

  constructor(private readonly urls: CountryDataUrls) {}

  async load(): Promise<DataLoadReport> {
    const [factsResult, marketResult] = await Promise.allSettled([
      fetchJson<CountryFactsFile>(this.urls.factsUrl),
      fetchJson<MarketProfileFile>(this.urls.marketUrl),
    ]);

    const errors: string[] = [];
    let facts: CountryFactsFile | null = null;
    let market: MarketProfileFile | null = null;

    if (factsResult.status === 'fulfilled' && isRecord(factsResult.value?.countries)) {
      facts = factsResult.value;
    } else {
      errors.push(
        factsResult.status === 'rejected'
          ? `国家资料加载失败：${errorMessage(factsResult.reason)}`
          : '国家资料格式无效',
      );
    }

    if (marketResult.status === 'fulfilled' && isRecord(marketResult.value?.countries)) {
      market = marketResult.value;
    } else {
      errors.push(
        marketResult.status === 'rejected'
          ? `市场档案加载失败：${errorMessage(marketResult.reason)}`
          : '市场档案格式无效',
      );
    }

    this.resolver = createCountryResolver(facts, market);
    this.report = {
      factsLoaded: facts !== null,
      marketLoaded: market !== null,
      errors,
    };
    return this.report;
  }

  resolve(shape: CountryShape): CountryDetail {
    return this.resolver(shape);
  }

  getReport(): DataLoadReport {
    return this.report;
  }
}

/**
 * Pure factory, easy to unit-test with fixtures. Both files are optional.
 */
export function createCountryResolver(
  factsFile: CountryFactsFile | null,
  marketFile: MarketProfileFile | null,
): CountryResolver {
  const facts = factsFile ?? EMPTY_FACTS;
  const market = marketFile ?? EMPTY_MARKET;

  const factsIndex = new Map<string, CountryFacts>();
  for (const [rawKey, entry] of Object.entries(facts.countries ?? {})) {
    if (!isRecord(entry)) continue;
    addFactKeys(factsIndex, entry, rawKey);
  }

  const marketIndex = new Map<string, MarketProfile>();
  for (const [rawKey, entry] of Object.entries(market.countries ?? {})) {
    if (!isRecord(entry)) continue;
    const profile = entry as MarketProfile;
    for (const key of keyVariants(rawKey)) {
      if (!marketIndex.has(key)) marketIndex.set(key, profile);
    }
  }

  const marketMeta: MarketMeta = {
    ...DEFAULT_MARKET_META,
    available: marketIndex.size > 0,
    demo: market.meta?.demo === true,
    notice: typeof market.meta?.notice === 'string' ? market.meta.notice : null,
    updated: typeof market.meta?.updated === 'string' ? market.meta.updated : null,
  };

  return (shape: CountryShape): CountryDetail => {
    const fact = lookupFacts(factsIndex, shape);
    const profile = lookupMarket(marketIndex, shape, fact);

    const name = fact?.name ?? shape.name;
    const nameZh = typeof fact?.nameZh === 'string' && fact.nameZh ? fact.nameZh : null;

    return {
      id: shape.id,
      name,
      nameZh,
      label: nameZh ?? name,
      iso2: fact?.iso2 ?? null,
      iso3: fact?.iso3 ?? null,
      capital: fact?.capital ?? null,
      region: fact?.region ?? null,
      subregion: fact?.subregion ?? null,
      area: typeof fact?.area === 'number' ? fact.area : null,
      flag: fact?.flag ?? null,
      market: profile,
      marketMeta,
      hasFacts: fact != null,
    };
  };
}

function addFactKeys(
  index: Map<string, CountryFacts>,
  fact: CountryFacts,
  rawKey: string,
): void {
  const keys = new Set<string>(keyVariants(rawKey));

  if (fact.iso2) keys.add(`a2:${fact.iso2.toUpperCase()}`);
  if (fact.iso3) keys.add(`a3:${fact.iso3.toUpperCase()}`);
  const nameKey = normalizeCountryName(fact.name);
  if (nameKey) keys.add(`name:${nameKey}`);

  for (const key of keys) {
    if (!index.has(key)) index.set(key, fact);
  }
}

function lookupFacts(
  index: Map<string, CountryFacts>,
  shape: CountryShape,
): CountryFacts | null {
  for (const key of shapeKeys(shape)) {
    const fact = index.get(key);
    if (fact) return fact;
  }
  return null;
}

function lookupMarket(
  index: Map<string, MarketProfile>,
  shape: CountryShape,
  fact: CountryFacts | null,
): MarketProfile | null {
  const keys = new Set<string>(shapeKeys(shape));
  if (fact?.iso2) keys.add(`a2:${fact.iso2.toUpperCase()}`);
  if (fact?.iso3) keys.add(`a3:${fact.iso3.toUpperCase()}`);
  const factName = normalizeCountryName(fact?.name);
  if (factName) keys.add(`name:${factName}`);

  for (const key of keys) {
    const profile = index.get(key);
    if (profile) return profile;
  }
  return null;
}

function shapeKeys(shape: CountryShape): string[] {
  const keys: string[] = [];
  const numeric = normalizeNumericCode(shape.id);
  if (numeric) keys.push(`ccn3:${numeric}`);
  const name = normalizeCountryName(shape.name);
  if (name) keys.push(`name:${name}`);
  return keys;
}

function keyVariants(rawKey: string): string[] {
  const key = rawKey.trim();
  if (!key) return [];
  if (/^\d+$/.test(key)) return [`ccn3:${key.padStart(3, '0')}`];
  if (/^[a-z]{2}$/i.test(key)) return [`a2:${key.toUpperCase()}`];
  if (/^[a-z]{3}$/i.test(key)) return [`a3:${key.toUpperCase()}`];
  return [`raw:${key.toLowerCase()}`];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} · ${url}`);
  }
  return (await response.json()) as T;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}
