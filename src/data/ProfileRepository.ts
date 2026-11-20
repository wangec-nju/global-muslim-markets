import type { CountryProfile, ProfileDataset } from './types';

/**
 * Loads the public-domain country dossier dataset and indexes it by ISO3.
 * The data is intentionally separate from markets.json: market metrics are
 * curated CSVs, dossiers come from public geographic/reference datasets.
 */
export class ProfileRepository {
  private dataset: ProfileDataset | null = null;
  private readonly byIso3 = new Map<string, CountryProfile>();

  constructor(private readonly url: string) {}

  async load(): Promise<void> {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error(`Failed to load profiles: ${response.status}`);
    this.dataset = (await response.json()) as ProfileDataset;
    this.byIso3.clear();
    for (const profile of this.dataset.profiles) this.byIso3.set(profile.iso3, profile);
  }

  get(iso3: string): CountryProfile | null {
    return this.byIso3.get(iso3) ?? null;
  }

  get china(): CountryProfile | null {
    return this.byIso3.get('CHN') ?? null;
  }

  list(): CountryProfile[] {
    return this.dataset?.profiles.filter((profile) => !profile.isChina) ?? [];
  }

  get meta(): ProfileDataset['meta'] | null {
    return this.dataset?.meta ?? null;
  }
}
