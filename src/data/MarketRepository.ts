import type { CountryShape } from '../globe/types';
import type { MarketCountry, MarketDataset } from './types';

/**
 * Loads the pre-built market dataset and resolves a globe shape to its market
 * snapshot. Market data is the only dataset the app needs; country facts are
 * intentionally not part of the model.
 */
export class MarketRepository {
  private marketsById = new Map<string, MarketCountry>();
  private marketsByIso3 = new Map<string, MarketCountry>();
  private marketsByName = new Map<string, MarketCountry>();
  private markets: MarketCountry[] = [];
  private dataset: MarketDataset | null = null;

  constructor(private readonly url: string) {}

  async load(): Promise<MarketDataset> {
    const response = await fetch(this.url, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`市场数据加载失败：HTTP ${response.status}`);
    }

    const data = (await response.json()) as MarketDataset;
    if (!data || !Array.isArray(data.countries) || data.countries.length === 0) {
      throw new Error('市场数据格式无效或为空');
    }

    this.dataset = data;
    this.markets = [];
    this.marketsById.clear();
    this.marketsByIso3.clear();
    this.marketsByName.clear();

    for (const market of data.countries) {
      if (!market?.id || !market.nameZh) continue;
      this.markets.push(market);
      this.marketsById.set(market.id, market);
      this.marketsByIso3.set(market.iso3, market);
      this.marketsByName.set(normalizeName(market.nameEn), market);
    }

    if (this.markets.length === 0) {
      throw new Error('市场数据中没有可用国家');
    }

    return data;
  }

  resolve(shape: CountryShape): MarketCountry | null {
    return (
      this.marketsById.get(shape.id) ??
      this.marketsByIso3.get(shape.id) ??
      this.marketsByName.get(normalizeName(shape.name)) ??
      null
    );
  }

  list(): MarketCountry[] {
    return this.markets;
  }

  get meta(): MarketDataset['meta'] | null {
    return this.dataset?.meta ?? null;
  }

  get focusIds(): Set<string> {
    return new Set(this.markets.filter((market) => market.focus).map((market) => market.id));
  }
}

/** Pure index used by tests and by callers that already have a dataset. */
export function createMarketIndex(
  dataset: MarketDataset,
): (shape: CountryShape) => MarketCountry | null {
  const byId = new Map<string, MarketCountry>();
  const byIso3 = new Map<string, MarketCountry>();
  const byName = new Map<string, MarketCountry>();

  for (const market of dataset.countries) {
    byId.set(market.id, market);
    byIso3.set(market.iso3, market);
    byName.set(normalizeName(market.nameEn), market);
  }

  return (shape) =>
    byId.get(shape.id) ??
    byIso3.get(shape.id) ??
    byName.get(normalizeName(shape.name)) ??
    null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
