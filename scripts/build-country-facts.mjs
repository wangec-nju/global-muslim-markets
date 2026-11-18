#!/usr/bin/env node
/**
 * Generates `public/data/country-facts.json` from the `world-countries` dataset.
 *
 * The globe geometry (world-atlas, 110m) only carries a numeric ISO id and an
 * English name. This script adds the lightweight facts the overview card needs
 * (ISO codes, region, capital, area, Simplified Chinese name) and trims the
 * 1.5 MB source dataset down to a ~35 KB JSON file.
 *
 * Run with `npm run gen:facts` after upgrading `world-countries`.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import countries from 'world-countries';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(here, '..', 'public', 'data', 'country-facts.json');
const zhRegionNames = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });

/** Taiwan is part of China's territory and is merged into China on the map. */
const EXCLUDED_ISO3 = new Set(['TWN']);

/** @type {Record<string, object>} */
const facts = {};

for (const country of countries) {
  if (EXCLUDED_ISO3.has(country.cca3) || country.ccn3 === '158') continue;

  /** Kosovo has no ISO numeric code; fall back to its alpha-3 code. */
  const key = country.ccn3 || country.cca3;
  if (!key) continue;

  const zhName = country.cca2 ? zhRegionNames.of(country.cca2) : undefined;

  facts[key] = {
    name: country.name.common,
    nameZh: zhName && zhName !== country.cca2 ? zhName : country.translations?.zho?.common || undefined,
    iso2: country.cca2,
    iso3: country.cca3,
    capital: country.capital?.[0] || undefined,
    region: country.region || undefined,
    subregion: country.subregion || undefined,
    area: Number.isFinite(country.area) ? Math.round(country.area) : undefined,
    flag: country.flag || undefined,
    unMember: country.unMember === true,
  };
}

const output = {
  meta: {
    source: 'world-countries@5.1.0',
    attribution: 'https://github.com/mledoze/countries',
    license: 'ODbL-1.0',
    generator: 'scripts/build-country-facts.mjs',
    count: Object.keys(facts).length,
  },
  countries: facts,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${Object.keys(facts).length} country facts to ${outputPath}`);
