#!/usr/bin/env node
/**
 * Builds public/data/profiles.json from filtered public datasets.
 * All inputs are committed under data/source/; raw downloads are not.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import countries from 'world-countries';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const source = (name) => path.join(root, 'data', 'source', name);

const scope = readCsv(source('scope.csv'));
const factbook = indexBy(readCsv(source('profiles-factbook.csv')), (r) => r.iso3);
const admin1 = groupBy(readCsv(source('geo/admin1.csv')), (r) => r.iso3);
const cities = groupBy(readCsv(source('geo/cities.csv')), (r) => r.iso3);
const airports = groupBy(readCsv(source('geo/airports.csv')), (r) => r.iso3);
const ports = groupBy(readCsv(source('geo/ports.csv')), (r) => r.iso3);
const logistics = groupBy(readCsv(source('geo/logistics.csv')), (r) => r.iso3);
const hs2Rows = groupBy(readCsv(source('hs2-imports.csv')), (r) => r.iso3);
const chinaDivisions = readCsv(source('china-divisions.csv'));
const chinaCities = readCsv(source('china-cities.csv'));
const chinaHubs = readCsv(source('china-hubs.csv'));
const world = new Map(countries.map((country) => [country.cca3, country]));

const regionZh = {
  Africa: '非洲',
  Americas: '美洲',
  Asia: '亚洲',
  Europe: '欧洲',
  Oceania: '大洋洲',
  Antarctic: '南极洲',
};

const profiles = [];
for (const scopeRow of scope) {
  const iso3 = scopeRow['国家代码'];
  profiles.push(buildProfile(iso3, scopeRow['国家'], scopeRow['UN_M49代码'], false));
}
profiles.push(buildProfile('CHN', '中国', '156', true));

const sourceFiles = [
  'scope.csv',
  'profiles-factbook.csv',
  'geo/admin1.csv',
  'geo/cities.csv',
  'geo/airports.csv',
  'geo/ports.csv',
  'geo/logistics.csv',
  'geo/city-labels.csv',
  'hs2-imports.csv',
  'china-divisions.csv',
  'china-cities.csv',
  'china-hubs.csv',
];

const output = {
  meta: {
    generatedAt: '2026-11-20',
    profileCount: profiles.length,
    sourceFiles: Object.fromEntries(
      sourceFiles.map((file) => [
        file,
        createHash('sha256').update(readFileSync(source(file))).digest('hex'),
      ]),
    ),
    sources: [
      { name: 'world-countries', license: 'ODbL-1.0', use: '国旗、正式名称、官方语言、首都、地区、面积、货币、电话区号' },
      { name: 'CIA World Factbook', license: 'Public domain', use: '常用语言描述' },
      { name: 'GeoNames', license: 'CC BY 4.0', use: '一级行政区、城市人口/坐标/英文与本地名' },
      { name: 'Wikidata', license: 'CC0', use: '城市中文名（P1566 → 中文标签）' },
      { name: 'OurAirports', license: 'Public domain', use: '机场枢纽与坐标' },
      { name: 'NGA World Port Index', license: 'Public domain', use: '港口枢纽与坐标' },
      { name: 'UN Comtrade', license: 'Public data', use: '2023 年 HS2 进口额与结构' },
      { name: 'Project curated', license: 'CC BY 4.0', use: '中国省级行政区、中国主要城市与枢纽整理' },
    ],
    notes: [
      '行政区划为一级行政区名称列表，不含行政边界几何。',
      '机场/港口为按公开数据筛选的枢纽样本，不是全部设施。',
      'HS2 为 2023 年进口额前 5 章；无 2023 数据的国家留空，不补值。',
      '中国—市场“航线”仅按贸易额绘制示意弧线，不是实际海运航道。',
    ],
  },
  profiles,
};

writeFileSync(
  path.join(root, 'public', 'data', 'profiles.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);
console.log(`Wrote ${profiles.length} profiles to public/data/profiles.json`);

function buildProfile(iso3, nameZh, unM49, isChina) {
  const wc = world.get(iso3);
  if (!wc) throw new Error(`world-countries missing ${iso3}`);
  const fb = factbook.get(iso3) ?? {};
  const countryCities = isChina
    ? chinaCities.map(toCity)
    : (cities.get(iso3) ?? []).map(toCity).slice(0, 6);
  const capitalEn = wc.capital?.[0] ?? null;
  const capitalCity = countryCities.find(
    (city) => city.nameEn.toLowerCase() === String(capitalEn ?? '').toLowerCase(),
  );
  const officialLanguages = Object.entries(wc.languages ?? {}).map(([code, name]) => ({
    code,
    name,
  }));
  const currencyEntry = Object.entries(wc.currencies ?? {})[0];
  const hs2 = (hs2Rows.get(iso3) ?? [])
    .map((row) => ({
      code: row.hs2,
      name: row.name_en,
      valueUsd: toNumber(row.value_usd),
      sharePct: toNumber(row.share_pct),
      year: Number(row.year) || null,
    }))
    .filter((row) => row.valueUsd != null)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 5);

  const countryAirports = rankAirports(
    airports.get(iso3) ?? [],
    capitalEn,
    countryCities.slice(0, 3).map((city) => city.nameEn),
  ).slice(0, 3).map(airportHub);
  const countryPorts = (ports.get(iso3) ?? []).slice(0, 3).map(portHub);
  const countryLogistics = (logistics.get(iso3) ?? []).slice(0, 2).map(logisticsHub);
  const hubs = isChina
    ? chinaHubs.map((row) => ({
        type: row.type,
        name: row.name,
        nameZh: row.name_zh,
        code: row.code || null,
        city: row.city || null,
        lat: toNumber(row.lat),
        lng: toNumber(row.lng),
      }))
    : [...countryAirports, ...countryPorts, ...countryLogistics];

  const divisions = isChina
    ? chinaDivisions.map((row) => ({
        code: row.code,
        name: row.name_en,
        nameZh: row.name_zh,
        type: row.type,
      }))
    : (admin1.get(iso3) ?? []).map((row) => ({
        code: row.code,
        name: row.name,
        nameZh: row.name_zh || null,
        type: null,
      }));

  return {
    iso3,
    unM49: String(unM49).padStart(3, '0'),
    isChina,
    nameZh,
    nameEn: wc.name.common,
    officialName: wc.name.official,
    flag: wc.flag ?? null,
    flagUrl: wc.cca2 ? `flags/${wc.cca2.toLowerCase()}.png` : null,
    officialLanguages,
    commonLanguages: fb.common_languages || null,
    capital: {
      nameEn: capitalEn,
      nameZh: capitalCity?.nameZh ?? null,
    },
    region: wc.region ?? null,
    regionZh: regionZh[wc.region] ?? null,
    subregion: wc.subregion ?? null,
    areaKm2: wc.area ?? null,
    currency: currencyEntry
      ? { code: currencyEntry[0], name: currencyEntry[1].name, symbol: currencyEntry[1].symbol }
      : null,
    callingCode: callingCode(wc.idd),
    wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(
      wc.name.common.replaceAll(' ', '_'),
    )}`,
    divisions,
    cities: countryCities,
    hubs,
    hs2,
    coverage: {
      officialLanguages: officialLanguages.length,
      commonLanguages: Boolean(fb.common_languages),
      divisions: divisions.length,
      cities: countryCities.length,
      airports: hubs.filter((hub) => hub.type === 'airport').length,
      ports: hubs.filter((hub) => hub.type === 'port').length,
      logistics: hubs.filter((hub) => hub.type === 'logistics').length,
      hs2: hs2.length,
    },
    sources: {
      identity: 'world-countries',
      commonLanguages: 'CIA World Factbook',
      divisions: isChina ? 'Project curated' : 'GeoNames',
      cities: isChina ? 'Project curated / GeoNames' : 'GeoNames + Wikidata labels',
      hubs: isChina ? 'Project curated / OurAirports / WPI / UN/LOCODE' : 'OurAirports + NGA World Port Index + UN/LOCODE',
      hs2: 'UN Comtrade 2023',
    },
  };
}

function toCity(row) {
  return {
    nameEn: row.name_en,
    nameLocal: row.name_local,
    nameZh: row.name_zh || null,
    population: toNumber(row.population),
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    admin1: row.admin1_name || null,
  };
}

function airportHub(row) {
  return {
    type: 'airport',
    subtype: row.type,
    name: row.name,
    nameZh: null,
    code: row.iata || null,
    city: row.city || null,
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
  };
}

function portHub(row) {
  return {
    type: 'port',
    subtype: row.size,
    name: row.name,
    nameZh: null,
    code: row.locode || null,
    city: null,
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
  };
}

function logisticsHub(row) {
  return {
    type: 'logistics',
    subtype: row.subtype,
    name: row.name,
    nameZh: null,
    code: row.locode || null,
    city: null,
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
  };
}

function rankAirports(rows, capital, topCities) {
  const capitalKey = String(capital ?? '').toLowerCase();
  const cityKeys = new Set(topCities.map((city) => city.toLowerCase()));
  return [...rows].sort((a, b) => {
    const score = (row) => {
      const city = String(row.city ?? '').toLowerCase();
      if (city && city === capitalKey) return 0;
      if (capitalKey && row.name.toLowerCase().includes(capitalKey)) return 0;
      if (city && cityKeys.has(city)) return 1;
      if (/international/i.test(row.name)) return 2;
      return 3;
    };
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });
}

function callingCode(idd) {
  if (!idd?.root) return null;
  const suffix = idd.suffixes?.[0] ?? '';
  return `${idd.root}${suffix}`;
}

function toNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

function readCsv(file) {
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return parseCsv(text);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const header = (rows.shift() ?? []).map((value) => value.trim());
  return rows
    .filter((values) => values.some((value) => value !== ''))
    .map((values) =>
      Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])),
    );
}
