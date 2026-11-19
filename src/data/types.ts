export interface MetricValue {
  value: number;
  year: string | null;
}

export interface MarketMetrics {
  population: MetricValue | null;
  populationGrowth: MetricValue | null;
  urbanShare: MetricValue | null;
  youthShare: MetricValue | null;
  workingAgeShare: MetricValue | null;
  seniorShare: MetricValue | null;
  gdp: MetricValue | null;
  gdpPerCapita: MetricValue | null;
  gniPerCapita: MetricValue | null;
  householdConsumption: MetricValue | null;
  householdConsumptionPerCapita: MetricValue | null;
  internetPenetration: MetricValue | null;
  goodsExports: MetricValue | null;
  goodsImports: MetricValue | null;
}

export interface MuslimStat {
  status: 'official' | 'unavailable';
  share: number | null;
  population: number | null;
  year: string | null;
  source: string | null;
  note: string | null;
}

export interface TradeFlow {
  year: string;
  value: number | null;
  yoy: number | null;
  shareOfChinaTotal: number | null;
  cagr2020_2025: number | null;
}

export interface ProductImport {
  code: string;
  name: string;
  category: string | null;
  worldImports: number;
  chinaImports: number | null;
  chinaShare: number | null;
}

export interface MarketCountry {
  id: string;
  unM49: string;
  iso3: string;
  nameZh: string;
  nameEn: string;
  flag: string | null;
  focus: boolean;
  metrics: MarketMetrics;
  muslim: MuslimStat;
  chinaTrade: {
    year: string;
    exports: TradeFlow | null;
    imports: TradeFlow | null;
  } | null;
  products: ProductImport[];
}

export interface MarketMeta {
  generatedAt: string;
  dataUpdated: string;
  scope: string;
  focusCount: number;
  marketCount: number;
  officialMuslimCount: number;
  notes: string[];
  sources: Array<{ name: string; note: string }>;
}

export interface MarketDataset {
  meta: MarketMeta;
  countries: MarketCountry[];
}
