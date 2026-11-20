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

export interface FieldSource {
  file?: string;
  source?: string;
  field?: string;
  valueField?: string;
  yearField?: string;
  filter?: string;
  derived?: string;
  fields?: string[];
  crossCheck?: string;
}

export interface ProductImport {
  code: string;
  name: string;
  category: string | null;
  worldImports: number;
  chinaImports: number | null;
  chinaShare: number | null;
}

export interface ProfileLanguage {
  code: string;
  name: string;
}

export interface ProfileCapital {
  nameEn: string | null;
  nameZh: string | null;
}

export interface ProfileDivision {
  code: string;
  name: string;
  nameZh: string | null;
  type: string | null;
}

export interface ProfileCity {
  nameEn: string;
  nameLocal: string;
  nameZh: string | null;
  population: number | null;
  lat: number | null;
  lng: number | null;
  admin1: string | null;
}

export interface ProfileHub {
  type: 'airport' | 'port';
  subtype: string | null;
  name: string;
  nameZh: string | null;
  code: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ProfileHs2 {
  code: string;
  name: string;
  valueUsd: number | null;
  sharePct: number | null;
  year: number | null;
}

export interface CountryProfile {
  iso3: string;
  unM49: string;
  isChina: boolean;
  nameZh: string;
  nameEn: string;
  officialName: string;
  flag: string | null;
  flagUrl: string | null;
  officialLanguages: ProfileLanguage[];
  commonLanguages: string | null;
  capital: ProfileCapital;
  region: string | null;
  regionZh: string | null;
  subregion: string | null;
  areaKm2: number | null;
  currency: { code: string; name: string; symbol?: string } | null;
  callingCode: string | null;
  wikipediaUrl: string;
  divisions: ProfileDivision[];
  cities: ProfileCity[];
  hubs: ProfileHub[];
  hs2: ProfileHs2[];
  coverage: {
    officialLanguages: number;
    commonLanguages: boolean;
    divisions: number;
    cities: number;
    airports: number;
    ports: number;
    hs2: number;
  };
  sources: Record<string, string>;
}

export interface ProfileDataset {
  meta: {
    generatedAt: string;
    profileCount: number;
    sourceFiles: Record<string, string>;
    sources: Array<{ name: string; license: string; use: string }>;
    notes: string[];
  };
  profiles: CountryProfile[];
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
  /** Human-readable source row locators for this record. */
  sourceRow: Record<string, string>;
  /** Wikipedia-style dossier attached from profiles.json at runtime. */
  profile?: CountryProfile;
}

export interface MarketMeta {
  generatedAt: string;
  dataUpdated: string;
  scope: string;
  focusCount: number;
  marketCount: number;
  officialMuslimCount: number;
  /** SHA-256 of each curated CSV at generation time. */
  sourceFiles: Record<string, string>;
  /** JSON field -> source file/column mapping. */
  fieldSources: Record<string, FieldSource>;
  notes: string[];
  sources: Array<{ name: string; note: string }>;
}

export interface MarketDataset {
  meta: MarketMeta;
  countries: MarketCountry[];
}
