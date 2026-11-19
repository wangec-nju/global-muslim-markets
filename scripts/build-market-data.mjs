#!/usr/bin/env node
/**
 * Builds `public/data/markets.json` from the curated source CSVs in
 * `data/source/`.
 *
 * Design rules:
 * - Only market-facing fields are emitted; no capital/area/region facts.
 * - Missing values stay null. Nothing is forward-filled or treated as zero.
 * - Muslim population comes only from a verified official census snapshot.
 * - The 57-country scope is the OIC research sample, not a claim that every
 *   country is Muslim-majority.
 *
 * Run: npm run gen:markets
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import countries from 'world-countries';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const sourceDir = path.join(root, 'data', 'source');
const outputPath = path.join(root, 'public', 'data', 'markets.json');

const SOURCE_FILES = [
  'scope.csv',
  'market-latest.csv',
  'muslim-official.csv',
  'china-trade-yearly.csv',
  'china-trade-cagr.csv',
  'products-idn-mys.csv',
  'product-meta.csv',
  'wdi-dictionary.csv',
  'metric-long.csv',
];

const METRIC_FIELDS = {
  population: ['总人口_人', '总人口_年份'],
  populationGrowth: ['人口年增长率_%', '人口年增长率_年份'],
  urbanShare: ['城镇人口占比_%', '城镇人口占比_年份'],
  youthShare: ['0至14岁人口占比_%', '0至14岁人口占比_年份'],
  workingAgeShare: ['15至64岁人口占比_%', '15至64岁人口占比_年份'],
  seniorShare: ['65岁及以上人口占比_%', '65岁及以上人口占比_年份'],
  gdp: ['GDP现价美元_美元', 'GDP现价美元_年份'],
  gdpPerCapita: ['人均GDP现价美元_美元/人', '人均GDP现价美元_年份'],
  gniPerCapita: ['人均GNI阿特拉斯法_美元/人', '人均GNI阿特拉斯法_年份'],
  householdConsumption: [
    '住户和为住户服务的非营利机构最终消费支出_美元',
    '住户和为住户服务的非营利机构最终消费支出_年份',
  ],
  householdConsumptionPerCapita: [
    '住户和非营利机构人均最终消费支出不变价_2015年不变价美元/人',
    '住户和非营利机构人均最终消费支出不变价_年份',
  ],
  internetPenetration: ['使用互联网的人口占比_%', '使用互联网的人口占比_年份'],
  goodsExports: ['货物出口额_美元', '货物出口额_年份'],
  goodsImports: ['货物进口额_美元', '货物进口额_年份'],
};

const FIELD_SOURCES = {
  nameZh: { file: 'scope.csv', field: '国家' },
  nameEn: { source: 'world-countries@5.1.0', field: 'name.common' },
  flag: { source: 'world-countries@5.1.0', field: 'flag' },
  focus: { file: 'scope.csv', field: '16国重点样本' },
  ...Object.fromEntries(
    Object.entries(METRIC_FIELDS).map(([key, [valueField, yearField]]) => [
      `metrics.${key}`,
      { file: 'market-latest.csv', valueField, yearField },
    ]),
  ),
  'chinaTrade.year': {
    file: 'china-trade-yearly.csv',
    filter: 'latest year with a non-empty amount',
    field: '年份',
  },
  'chinaTrade.exports.value': {
    file: 'china-trade-yearly.csv',
    filter: 'direction=X; year=latest',
    field: '金额_美元',
  },
  'chinaTrade.exports.yoy': {
    file: 'china-trade-yearly.csv',
    filter: 'direction=X; year=latest',
    field: '同比_百分比',
  },
  'chinaTrade.exports.shareOfChinaTotal': {
    file: 'china-trade-yearly.csv',
    filter: 'direction=X; year=latest',
    field: '占中国同方向全球货物贸易_百分比',
  },
  'chinaTrade.exports.cagr2020_2025': {
    file: 'china-trade-cagr.csv',
    filter: 'direction=X',
    field: '2020至2025五年CAGR_百分比',
  },
  'chinaTrade.imports.value': {
    file: 'china-trade-yearly.csv',
    filter: 'direction=M; year=latest',
    field: '金额_美元',
  },
  'chinaTrade.imports.yoy': {
    file: 'china-trade-yearly.csv',
    filter: 'direction=M; year=latest',
    field: '同比_百分比',
  },
  'chinaTrade.imports.shareOfChinaTotal': {
    file: 'china-trade-yearly.csv',
    filter: 'direction=M; year=latest',
    field: '占中国同方向全球货物贸易_百分比',
  },
  'chinaTrade.imports.cagr2020_2025': {
    file: 'china-trade-cagr.csv',
    filter: 'direction=M',
    field: '2020至2025五年CAGR_百分比',
  },
  'muslim.status': {
    file: 'muslim-official.csv',
    derived: 'official when 穆斯林占比_百分比 is non-empty; otherwise unavailable',
  },
  'muslim.share': { file: 'muslim-official.csv', field: '穆斯林占比_百分比' },
  'muslim.population': { file: 'muslim-official.csv', field: '穆斯林人口_人' },
  'muslim.year': { file: 'muslim-official.csv', field: '普查年份' },
  'muslim.source': { file: 'muslim-official.csv', field: '统计机构' },
  'muslim.note': { file: 'muslim-official.csv', field: '注意' },
  'products[].code': { file: 'products-idn-mys.csv', field: 'HS编码' },
  'products[].name': { file: 'product-meta.csv', field: '中文名称' },
  'products[].category': { file: 'product-meta.csv', field: '二级品类' },
  'products[].worldImports': {
    file: 'products-idn-mys.csv',
    filter: 'year=2025; sort=自世界进口_美元 desc; top=4',
    field: '自世界进口_美元',
  },
  'products[].chinaImports': {
    file: 'products-idn-mys.csv',
    filter: 'year=2025; top=4 by worldImports',
    field: '自中国进口_美元',
  },
  'products[].chinaShare': {
    file: 'products-idn-mys.csv',
    filter: 'year=2025; top=4 by worldImports',
    field: '中国占该国该商品进口_百分比',
  },
};

const scope = readCsv('scope.csv');
const latest = indexBy(readCsv('market-latest.csv'), (row) => row['国家代码']);
const muslim = indexBy(readCsv('muslim-official.csv'), (row) => row['国家代码']);
const tradeYearly = indexBy(
  readCsv('china-trade-yearly.csv'),
  (row) => `${row['伙伴代码']}|${row['方向']}|${row['年份']}`,
);
const tradeCagr = indexBy(
  readCsv('china-trade-cagr.csv'),
  (row) => `${row['伙伴代码']}|${row['方向']}`,
);
const productMeta = new Map();
for (const row of readCsv('product-meta.csv')) {
  if (!productMeta.has(row['HS编码'])) {
    productMeta.set(row['HS编码'], {
      name: row['中文名称'] || `HS ${row['HS编码']}`,
      category: row['二级品类'] || null,
    });
  }
}
const productRows = readCsv('products-idn-mys.csv');
const worldCountries = new Map(countries.map((country) => [country.cca3, country]));

const markets = scope.map((row) => {
  const iso3 = row['国家代码'];
  const base = latest.get(iso3) ?? {};
  const wc = worldCountries.get(iso3);
  const unM49 = String(row['UN_M49代码']).trim().padStart(3, '0');
  const reportName = iso3 === 'IDN' ? '印度尼西亚' : iso3 === 'MYS' ? '马来西亚' : null;
  if (!unM49 || !/^\d{3}$/.test(unM49)) {
    throw new Error(`Invalid UN M49 code for ${iso3}: ${row['UN_M49代码']}`);
  }

  const metrics = Object.fromEntries(
    Object.entries(METRIC_FIELDS).map(([key, [valueField, yearField]]) => [
      key,
      metric(base, valueField, yearField),
    ]),
  );

  return {
    id: unM49,
    unM49,
    iso3,
    nameZh: row['国家'],
    nameEn: wc?.name.common ?? iso3,
    flag: wc?.flag ?? null,
    focus: row['16国重点样本'] === 'True',
    metrics,
    muslim: buildMuslim(muslim.get(iso3)),
    chinaTrade: {
      year: '2025',
      exports: buildTradeFlow(tradeYearly, tradeCagr, iso3, 'X'),
      imports: buildTradeFlow(tradeYearly, tradeCagr, iso3, 'M'),
    },
    products: buildProducts(productRows, productMeta, iso3),
    sourceRow: {
      scope: `scope.csv#${iso3}`,
      metrics: `market-latest.csv#${iso3}`,
      trade: `china-trade-yearly.csv#${iso3}/X,M/2025`,
      cagr: `china-trade-cagr.csv#${iso3}/X,M`,
      muslim: `muslim-official.csv#${iso3}`,
      ...(reportName
        ? { products: `products-idn-mys.csv#${reportName}/2025` }
        : {}),
    },
  };
});

const focusCount = markets.filter((market) => market.focus).length;
const officialMuslimCount = markets.filter((market) => market.muslim.status === 'official').length;
const productMarketCount = markets.filter((market) => market.products.length > 0).length;

if (markets.length !== 57) throw new Error(`Expected 57 markets, got ${markets.length}`);
if (focusCount !== 16) throw new Error(`Expected 16 focus markets, got ${focusCount}`);
if (officialMuslimCount !== 6) {
  throw new Error(`Expected 6 verified Muslim population snapshots, got ${officialMuslimCount}`);
}
if (productMarketCount !== 2) {
  throw new Error(`Expected product coverage for 2 markets, got ${productMarketCount}`);
}

const dataset = {
  meta: {
    generatedAt: '2026-11-19',
    dataUpdated: '2026-11',
    scope: 'OIC 57 国固定研究样本',
    focusCount,
    marketCount: markets.length,
    officialMuslimCount,
    sourceFiles: Object.fromEntries(
      SOURCE_FILES.map((file) => [
        file,
        createHash('sha256').update(readFileSync(path.join(sourceDir, file))).digest('hex'),
      ]),
    ),
    fieldSources: FIELD_SOURCES,
    notes: [
      '国家总体指标覆盖全部人口与经济，不是穆斯林专属口径。',
      '缺失值保持为空，不补零、不前填。',
      '穆斯林人口与占比只采用已核实的官方普查快照；其余国家不推断。',
      '代表进口品类为研究筛选口径，不是清真认证目录。',
      '中国贸易为 2025 年中国对目标市场出口（X）与进口（M）。',
    ],
    sources: [
      { name: '世界银行 WDI', note: '2020—2025 各指标最新可得值' },
      { name: '中国海关', note: '2020—2025 中国对 57 国进出口' },
      { name: 'UN Comtrade', note: '印度尼西亚、马来西亚代表品类进口' },
      { name: '各国官方统计', note: '穆斯林人口仅采用已核实官方普查' },
      { name: 'SESRIC / OIC', note: '57 国固定研究样本范围' },
    ],
  },
  countries: markets,
};

writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(
  `Wrote ${markets.length} markets (${focusCount} focus, ${officialMuslimCount} official Muslim snapshots) to ${outputPath}`,
);

function metric(row, valueField, yearField) {
  const raw = row[valueField];
  if (raw == null || String(raw).trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return {
    value,
    year: String(row[yearField] ?? '').trim() || null,
  };
}

function buildMuslim(row) {
  const share = row ? toNumber(row['穆斯林占比_百分比']) : null;
  const base = {
    status: 'unavailable',
    share: null,
    population: null,
    year: null,
    source: null,
    note:
      row?.['注意'] ||
      '未取得已核实官方宗教统计；不代表不存在，也不以 OIC 成员身份推断。',
  };
  if (share == null) return base;

  return {
    status: 'official',
    share,
    population: toNumber(row['穆斯林人口_人']),
    year: String(row['普查年份'] ?? '').trim() || null,
    source: String(row['统计机构'] ?? '').trim() || null,
    note: String(row['注意'] ?? '').trim() || null,
  };
}

function buildTradeFlow(yearly, cagr, iso3, direction) {
  const years = [2025, 2024, 2023, 2022, 2021];
  const year = years.find((candidate) => yearly.has(`${iso3}|${direction}|${candidate}`));
  if (!year) return null;
  const row = yearly.get(`${iso3}|${direction}|${year}`);
  const cagrRow = cagr.get(`${iso3}|${direction}`);

  return {
    year: String(year),
    value: toNumber(row['金额_美元']),
    yoy: toNumber(row['同比_百分比']),
    shareOfChinaTotal: toNumber(row['占中国同方向全球货物贸易_百分比']),
    cagr2020_2025: toNumber(cagrRow?.['2020至2025五年CAGR_百分比']),
  };
}

function buildProducts(rows, meta, iso3) {
  if (iso3 !== 'IDN' && iso3 !== 'MYS') return [];
  const reportName = iso3 === 'IDN' ? '印度尼西亚' : '马来西亚';
  return rows
    .filter((row) => row['进口报告国'] === reportName && row['年份'] === '2025')
    .map((row) => {
      const code = row['HS编码'];
      const info = meta.get(code);
      return {
        code,
        name: info?.name ?? `HS ${code}`,
        category: info?.category ?? null,
        worldImports: toNumber(row['自世界进口_美元']) ?? 0,
        chinaImports: toNumber(row['自中国进口_美元']),
        chinaShare: toNumber(row['中国占该国该商品进口_百分比']),
      };
    })
    .filter((product) => product.worldImports > 0)
    .sort((a, b) => b.worldImports - a.worldImports)
    .slice(0, 4);
}

function toNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

function readCsv(fileName) {
  const text = readFileSync(path.join(sourceDir, fileName), 'utf8').replace(/^\uFEFF/, '');
  return parseCsv(text);
}

/** Minimal RFC4180-style parser for the curated CSV files. */
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

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
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
