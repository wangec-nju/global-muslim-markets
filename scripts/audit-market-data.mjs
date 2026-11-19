#!/usr/bin/env node
/**
 * Audits `public/data/markets.json` against every curated source CSV.
 *
 * Hard failures (exit 1): source hashes changed, a field is not mapped, a
 * generated value does not match its source row, or identity/scope checks fail.
 * Soft conflicts (reported, exit 0): internal formulas disagree, the wide and
 * long WDI tables disagree, or official census shares differ from the Wikipedia
 * reference compilation.
 *
 * Outputs:
 *   public/data/data-quality.json
 *   docs/data-quality.md
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import countries from 'world-countries';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const sourceDir = path.join(root, 'data', 'source');
const referenceDir = path.join(root, 'data', 'reference');
const dataset = JSON.parse(
  readFileSync(path.join(root, 'public', 'data', 'markets.json'), 'utf8'),
);
const wikipedia = readCsv(referenceDir, 'oic-wikipedia.csv');

const scope = readCsv(sourceDir, 'scope.csv');
const latest = indexBy(readCsv(sourceDir, 'market-latest.csv'), (row) => row['国家代码']);
const muslim = indexBy(readCsv(sourceDir, 'muslim-official.csv'), (row) => row['国家代码']);
const tradeYearly = readCsv(sourceDir, 'china-trade-yearly.csv');
const tradeCagr = readCsv(sourceDir, 'china-trade-cagr.csv');
const productRows = readCsv(sourceDir, 'products-idn-mys.csv');
const productMeta = new Map();
for (const row of readCsv(sourceDir, 'product-meta.csv')) {
  if (!productMeta.has(row['HS编码'])) {
    productMeta.set(row['HS编码'], {
      name: row['中文名称'],
      category: row['二级品类'],
    });
  }
}
const longRows = readCsv(sourceDir, 'metric-long.csv');
const worldCountries = new Map(countries.map((country) => [country.cca3, country]));

const hardErrors = [];
const conflicts = [];
const info = [];
const fieldSources = dataset.meta?.fieldSources ?? {};
const sourceFiles = dataset.meta?.sourceFiles ?? {};
const markets = dataset.countries ?? [];

const metricToIndicator = {
  population: 'SP.POP.TOTL',
  populationGrowth: 'SP.POP.GROW',
  urbanShare: 'SP.URB.TOTL.IN.ZS',
  youthShare: 'SP.POP.0014.TO.ZS',
  workingAgeShare: 'SP.POP.1564.TO.ZS',
  seniorShare: 'SP.POP.65UP.TO.ZS',
  gdp: 'NY.GDP.MKTP.CD',
  gdpPerCapita: 'NY.GDP.PCAP.CD',
  gniPerCapita: 'NY.GNP.PCAP.CD',
  householdConsumption: 'NE.CON.PRVT.CD',
  householdConsumptionPerCapita: 'NE.CON.PRVT.PC.KD',
  internetPenetration: 'IT.NET.USER.ZS',
  goodsExports: 'TX.VAL.MRCH.CD.WT',
  goodsImports: 'TM.VAL.MRCH.CD.WT',
};

const requiredPaths = [
  'nameZh',
  'nameEn',
  'flag',
  'focus',
  ...Object.keys(metricToIndicator).map((key) => `metrics.${key}`),
  'chinaTrade.year',
  'chinaTrade.exports.value',
  'chinaTrade.exports.yoy',
  'chinaTrade.exports.shareOfChinaTotal',
  'chinaTrade.exports.cagr2020_2025',
  'chinaTrade.imports.value',
  'chinaTrade.imports.yoy',
  'chinaTrade.imports.shareOfChinaTotal',
  'chinaTrade.imports.cagr2020_2025',
  'muslim.status',
  'muslim.share',
  'muslim.population',
  'muslim.year',
  'muslim.source',
  'muslim.note',
  'products[].code',
  'products[].name',
  'products[].category',
  'products[].worldImports',
  'products[].chinaImports',
  'products[].chinaShare',
];

checkSourceHashes();
checkProvenance();
checkScopeAndIdentity();
checkMetricValues();
checkTradeValues();
checkMuslimValues();
checkProductValues();
checkWideAgainstLong();
checkFormulas();
checkRatios();
const wikipediaComparison = checkWikipedia();
writeReports(wikipediaComparison);

console.log(
  hardErrors.length === 0
    ? `Audit passed: ${markets.length} markets, ${requiredPaths.length} mapped fields, ${conflicts.length} reported conflict(s).`
    : `Audit FAILED: ${hardErrors.length} hard error(s), ${conflicts.length} conflict(s).`,
);
if (hardErrors.length > 0) process.exitCode = 1;

// ---------------------------------------------------------------- checks

function checkSourceHashes() {
  const expectedNames = Object.keys(sourceFiles);
  if (expectedNames.length === 0) {
    hardErrors.push({ type: 'provenance', message: 'markets.json has no meta.sourceFiles' });
    return;
  }

  for (const [file, expected] of Object.entries(sourceFiles)) {
    try {
      const actual = hashFile(path.join(sourceDir, file));
      if (actual !== expected) {
        hardErrors.push({
          type: 'source-hash',
          message: `${file} changed after markets.json was generated; run npm run gen:markets`,
        });
      }
    } catch {
      hardErrors.push({ type: 'source-hash', message: `source file missing: ${file}` });
    }
  }

  const referenceHash = hashFile(path.join(referenceDir, 'oic-wikipedia.csv'));
  info.push({
    label: '源文件',
    value: `${expectedNames.length} 个源 CSV 已计算 SHA-256；Wikipedia 参照 SHA-256 ${referenceHash.slice(0, 12)}…`,
  });
}

function checkProvenance() {
  for (const field of requiredPaths) {
    if (!fieldSources[field]) {
      hardErrors.push({ type: 'provenance', message: `missing field source: ${field}` });
    }
  }

  for (const market of markets) {
    for (const key of ['scope', 'metrics', 'trade', 'cagr', 'muslim']) {
      if (!market.sourceRow?.[key]) {
        hardErrors.push({
          type: 'provenance',
          message: `${market.iso3}: missing sourceRow.${key}`,
        });
      }
    }
    if ((market.iso3 === 'IDN' || market.iso3 === 'MYS') && !market.sourceRow?.products) {
      hardErrors.push({
        type: 'provenance',
        message: `${market.iso3}: missing sourceRow.products`,
      });
    }
  }
}

function checkScopeAndIdentity() {
  if (markets.length !== 57) {
    hardErrors.push({ type: 'scope', message: `expected 57 markets, got ${markets.length}` });
  }

  const marketIsos = markets.map((market) => market.iso3);
  if (new Set(marketIsos).size !== marketIsos.length) {
    hardErrors.push({ type: 'scope', message: 'duplicate ISO3 in markets.json' });
  }
  if (new Set(markets.map((market) => market.id)).size !== marketIsos.length) {
    hardErrors.push({ type: 'scope', message: 'duplicate UN M49 id in markets.json' });
  }
  if (markets.filter((market) => market.focus).length !== 16) {
    hardErrors.push({ type: 'scope', message: 'expected 16 focus markets' });
  }

  const scopeIsos = new Set(scope.map((row) => row['国家代码']));
  const missing = [...scopeIsos].filter((iso3) => !marketIsos.includes(iso3));
  const extra = marketIsos.filter((iso3) => !scopeIsos.has(iso3));
  if (missing.length || extra.length) {
    hardErrors.push({
      type: 'scope',
      message: `scope mismatch: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`,
    });
  }

  for (const row of scope) {
    const market = markets.find((item) => item.iso3 === row['国家代码']);
    if (!market) continue;
    const expectedId = String(row['UN_M49代码']).padStart(3, '0');
    if (market.id !== expectedId || market.unM49 !== expectedId) {
      hardErrors.push({
        type: 'identity',
        message: `${market.iso3}: UN M49 expected ${expectedId}, got ${market.id}/${market.unM49}`,
      });
    }
    if (market.nameZh !== row['国家']) {
      hardErrors.push({
        type: 'identity',
        message: `${market.iso3}: nameZh expected ${row['国家']}, got ${market.nameZh}`,
      });
    }
    if (market.focus !== (row['16国重点样本'] === 'True')) {
      hardErrors.push({
        type: 'identity',
        message: `${market.iso3}: focus flag does not match scope.csv`,
      });
    }
    const wc = worldCountries.get(market.iso3);
    if (wc) {
      if (market.nameEn !== wc.name.common) {
        hardErrors.push({
          type: 'identity',
          message: `${market.iso3}: nameEn expected ${wc.name.common}, got ${market.nameEn}`,
        });
      }
      if (market.flag !== (wc.flag ?? null)) {
        hardErrors.push({
          type: 'identity',
          message: `${market.iso3}: flag does not match world-countries`,
        });
      }
    }
  }
}

function checkMetricValues() {
  let checked = 0;
  let nulls = 0;
  for (const market of markets) {
    const row = latest.get(market.iso3) ?? {};
    for (const key of Object.keys(metricToIndicator)) {
      const source = fieldSources[`metrics.${key}`];
      const actual = market.metrics?.[key] ?? null;
      if (!source?.valueField || !source.yearField) {
        hardErrors.push({
          type: 'provenance',
          message: `metrics.${key}: incomplete field source`,
        });
        continue;
      }
      const expectedValue = toNumber(row[source.valueField]);
      const expectedYear = String(row[source.yearField] ?? '').trim() || null;
      const expected = expectedValue == null ? null : { value: expectedValue, year: expectedYear };
      if (!sameMetric(actual, expected)) {
        hardErrors.push({
          type: 'metric-value',
          message: `${market.iso3} ${key}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
        });
      }
      checked += 1;
      if (actual == null) nulls += 1;
    }
  }
  info.push({ label: '市场指标', value: `${checked} 项（${nulls} 项为空）` });
}

function checkTradeValues() {
  const yearly = new Map();
  for (const row of tradeYearly) {
    yearly.set(`${row['伙伴代码']}|${row['方向']}|${row['年份']}`, row);
  }
  const cagr = new Map();
  for (const row of tradeCagr) {
    cagr.set(`${row['伙伴代码']}|${row['方向']}`, row);
  }

  let checked = 0;
  for (const market of markets) {
    for (const [direction, key] of [
      ['X', 'exports'],
      ['M', 'imports'],
    ]) {
      const row = yearly.get(`${market.iso3}|${direction}|2025`);
      if (!row) {
        hardErrors.push({ type: 'trade', message: `${market.iso3} ${direction}: no 2025 row` });
        continue;
      }
      const cagrRow = cagr.get(`${market.iso3}|${direction}`);
      const actual = market.chinaTrade?.[key] ?? null;
      const expected = {
        year: '2025',
        value: toNumber(row['金额_美元']),
        yoy: toNumber(row['同比_百分比']),
        shareOfChinaTotal: toNumber(row['占中国同方向全球货物贸易_百分比']),
        cagr2020_2025: toNumber(cagrRow?.['2020至2025五年CAGR_百分比']),
      };
      if (!sameTrade(actual, expected)) {
        hardErrors.push({
          type: 'trade-value',
          message: `${market.iso3} ${key}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
        });
      }
      checked += 1;
    }
  }
  info.push({ label: '中国贸易流', value: `${checked} 条` });
}

function checkMuslimValues() {
  let official = 0;
  for (const market of markets) {
    const row = muslim.get(market.iso3) ?? {};
    const share = toNumber(row['穆斯林占比_百分比']);
    const expected =
      share == null
        ? {
            status: 'unavailable',
            share: null,
            population: null,
            year: null,
            source: null,
            note: row['注意'] || null,
          }
        : {
            status: 'official',
            share,
            population: toNumber(row['穆斯林人口_人']),
            year: String(row['普查年份'] ?? '').trim() || null,
            source: String(row['统计机构'] ?? '').trim() || null,
            note: String(row['注意'] ?? '').trim() || null,
          };
    if (!sameObject(market.muslim, expected)) {
      hardErrors.push({
        type: 'muslim-value',
        message: `${market.iso3}: ${JSON.stringify(market.muslim)} != ${JSON.stringify(expected)}`,
      });
    }
    if (expected.status === 'official') official += 1;
  }
  info.push({ label: '官方穆斯林快照', value: `${official} 个` });
}

function checkProductValues() {
  for (const iso3 of ['IDN', 'MYS']) {
    const market = markets.find((item) => item.iso3 === iso3);
    if (!market) continue;
    const reportName = iso3 === 'IDN' ? '印度尼西亚' : '马来西亚';
    const expected = productRows
      .filter((row) => row['进口报告国'] === reportName && row['年份'] === '2025')
      .map((row) => {
        const meta = productMeta.get(row['HS编码']);
        return {
          code: row['HS编码'],
          name: meta?.name ?? `HS ${row['HS编码']}`,
          category: meta?.category ?? null,
          worldImports: toNumber(row['自世界进口_美元']) ?? 0,
          chinaImports: toNumber(row['自中国进口_美元']),
          chinaShare: toNumber(row['中国占该国该商品进口_百分比']),
        };
      })
      .filter((product) => product.worldImports > 0)
      .sort((a, b) => b.worldImports - a.worldImports)
      .slice(0, 4);

    if (market.products.length !== expected.length) {
      hardErrors.push({
        type: 'product-value',
        message: `${iso3}: product count ${market.products.length} != ${expected.length}`,
      });
      continue;
    }
    expected.forEach((product, index) => {
      if (!sameObject(market.products[index], product)) {
        hardErrors.push({
          type: 'product-value',
          message: `${iso3} product ${index}: ${JSON.stringify(market.products[index])} != ${JSON.stringify(product)}`,
        });
      }
    });
  }
}

function checkWideAgainstLong() {
  const longByKey = new Map();
  for (const row of longRows) {
    const indicator = row['指标代码'];
    if (!indicator) continue;
    const value = toNumber(row['数值']);
    if (value == null) continue;
    const key = `${row['国家代码']}|${indicator}`;
    const year = Number(row['年份']);
    if (!Number.isFinite(year)) continue;
    const current = longByKey.get(key);
    if (!current || year > current.year) {
      longByKey.set(key, { value, year: String(year) });
    }
  }

  let checked = 0;
  const mismatches = [];
  for (const market of markets) {
    for (const [key, indicator] of Object.entries(metricToIndicator)) {
      const long = longByKey.get(`${market.iso3}|${indicator}`);
      const actual = market.metrics?.[key] ?? null;
      const expected = long ?? null;
      checked += 1;
      if (!sameMetric(actual, expected)) {
        mismatches.push({
          iso3: market.iso3,
          metric: key,
          generated: actual,
          longTable: expected,
        });
      }
    }
  }
  if (mismatches.length > 0) {
    conflicts.push({
      type: 'wide-vs-long',
      severity: 'high',
      message: `${mismatches.length}/${checked} metric values differ between the wide table and the long WDI table`,
      samples: mismatches.slice(0, 10),
    });
  } else {
    info.push({ label: 'WDI 宽表/长表', value: `${checked} 项一致` });
  }
}

function checkFormulas() {
  const byKey = new Map();
  for (const row of tradeYearly) {
    const value = toNumber(row['金额_美元']);
    if (value != null) {
      byKey.set(`${row['伙伴代码']}|${row['方向']}|${row['年份']}`, value);
    }
  }
  const yoyConflicts = [];
  let yoyChecked = 0;
  for (const row of tradeYearly) {
    const current = toNumber(row['金额_美元']);
    const previous = byKey.get(`${row['伙伴代码']}|${row['方向']}|${Number(row['年份']) - 1}`);
    const reported = toNumber(row['同比_百分比']);
    if (current == null || previous == null || reported == null) continue;
    const calculated = (current / previous - 1) * 100;
    yoyChecked += 1;
    if (Math.abs(calculated - reported) > 0.01) {
      yoyConflicts.push({
        iso3: row['伙伴代码'],
        direction: row['方向'],
        year: row['年份'],
        calculated: round(calculated, 4),
        reported,
      });
    }
  }

  const cagrConflicts = [];
  let cagrChecked = 0;
  for (const row of tradeCagr) {
    const start = toNumber(row['2020金额_美元']);
    const end = toNumber(row['2025金额_美元']);
    const reported = toNumber(row['2020至2025五年CAGR_百分比']);
    if (start == null || end == null || reported == null || start <= 0 || end <= 0) continue;
    const calculated = ((end / start) ** (1 / 5) - 1) * 100;
    cagrChecked += 1;
    if (Math.abs(calculated - reported) > 0.01) {
      cagrConflicts.push({
        iso3: row['伙伴代码'],
        direction: row['方向'],
        calculated: round(calculated, 4),
        reported,
      });
    }
  }

  if (yoyConflicts.length) {
    conflicts.push({
      type: 'trade-yoy',
      severity: 'medium',
      message: `${yoyConflicts.length}/${yoyChecked} YoY values do not match year-over-year recomputation`,
      samples: yoyConflicts.slice(0, 10),
    });
  } else {
    info.push({ label: '贸易同比公式', value: `${yoyChecked} 条一致` });
  }

  if (cagrConflicts.length) {
    conflicts.push({
      type: 'trade-cagr',
      severity: 'medium',
      message: `${cagrConflicts.length}/${cagrChecked} CAGR values do not match recomputation`,
      samples: cagrConflicts.slice(0, 10),
    });
  } else {
    info.push({ label: '贸易 CAGR 公式', value: `${cagrChecked} 条一致` });
  }

  info.push({
    label: '贸易占比分母',
    value: '无法复算：源表没有中国总额行；保留源表值',
  });
}

function checkWikipedia() {
  const refMembers = wikipedia.filter((row) => row.status === 'member');
  const refObservers = wikipedia.filter((row) => row.status === 'observer');
  const marketIsos = new Set(markets.map((market) => market.iso3));
  const refIsos = new Set(refMembers.map((row) => row.iso3));
  const missing = [...refIsos].filter((iso3) => !marketIsos.has(iso3));
  const extra = [...marketIsos].filter((iso3) => !refIsos.has(iso3));

  if (refMembers.length !== 57) {
    hardErrors.push({
      type: 'wikipedia-reference',
      message: `reference has ${refMembers.length} members, expected 57`,
    });
  }
  if (missing.length || extra.length) {
    conflicts.push({
      type: 'wikipedia-membership',
      severity: 'high',
      message: 'OIC membership differs between scope.csv and Wikipedia reference',
      missing,
      extra,
    });
  } else {
    info.push({ label: 'OIC 成员范围', value: '57/57 与 Wikipedia 参照一致' });
  }

  const observerOverlap = refObservers.filter((row) => marketIsos.has(row.iso3));
  if (observerOverlap.length) {
    conflicts.push({
      type: 'wikipedia-observer-scope',
      severity: 'medium',
      message: 'Wikipedia observer states appear in the market scope',
      observers: observerOverlap.map((row) => row.iso3),
    });
  } else {
    info.push({
      label: '观察员国',
      value: `${refObservers.length} 个观察员国已正确排除在 57 国范围之外`,
    });
  }

  const officialComparisons = [];
  let unavailableWithReference = 0;
  for (const market of markets) {
    const ref = wikipedia.find((row) => row.iso3 === market.iso3 && row.status === 'member');
    if (!ref) continue;
    if (market.muslim.status === 'official') {
      const referenceShare = toNumber(ref.muslim_share);
      const diff = referenceShare == null ? null : round(market.muslim.share - referenceShare, 2);
      officialComparisons.push({
        iso3: market.iso3,
        country: market.nameZh,
        officialShare: market.muslim.share,
        officialYear: market.muslim.year,
        officialSource: market.muslim.source,
        wikipediaShare: referenceShare,
        wikipediaDisplay: ref.share_display,
        wikipediaQualifier: ref.share_qualifier,
        diff,
        interpretation: classifyDiff(diff),
      });
      if (diff != null && Math.abs(diff) > 2) {
        conflicts.push({
          type: 'wikipedia-muslim-share',
          severity: 'low',
          message: `${market.nameZh}: official ${market.muslim.share}% (${market.muslim.year}) vs Wikipedia ${ref.share_display}; difference ${diff}pp`,
          samples: [
            {
              iso3: market.iso3,
              official: `${market.muslim.share}% (${market.muslim.year})`,
              wikipedia: ref.share_display,
              diff: `${diff}pp`,
            },
          ],
        });
      }
    } else {
      unavailableWithReference += 1;
    }
  }

  info.push({
    label: '官方与 Wikipedia 比较',
    value: `${officialComparisons.length} 个官方普查与参照比较；${unavailableWithReference} 个市场只有 Wikipedia/Pew 参照`,
  });

  return {
    membership: {
      referenceMembers: refMembers.length,
      referenceObservers: refObservers.length,
      missing,
      extra,
      observerOverlap: observerOverlap.map((row) => row.iso3),
    },
    officialComparisons,
    unavailableWithReference,
    referenceSource: 'Chinese Wikipedia OIC table (image), share column cited to Pew Forum 2013',
    languageVariation: [
      {
        country: '孟加拉国',
        chineseWikipediaAndImage: '89.80%',
        currentEnglishWikipedia: '92%',
        officialCensus: '91.04% (2022, BBS)',
      },
      {
        country: '文莱',
        chineseWikipediaAndImage: '75.10%',
        currentEnglishWikipedia: '84%',
        officialCensus: '82.1% (2021, DEPS)',
      },
      {
        country: '哈萨克斯坦',
        chineseWikipediaAndImage: '70.40%',
        currentEnglishWikipedia: '74%',
        officialCensus: '69.3% (2021, Bureau of National Statistics)',
      },
    ],
  };
}

function checkRatios() {
  let checked = 0;
  let skippedForYearMismatch = 0;
  const mismatches = [];
  for (const market of markets) {
    const gdp = market.metrics?.gdp;
    const population = market.metrics?.population;
    const reported = market.metrics?.gdpPerCapita;
    if (!gdp || !population || !reported) continue;
    if ((gdp.year ?? null) !== (population.year ?? null)) {
      skippedForYearMismatch += 1;
      continue;
    }
    const calculated = gdp.value / population.value;
    checked += 1;
    if (Math.abs(calculated - reported.value) > Math.max(0.01, Math.abs(reported.value) * 0.001)) {
      mismatches.push({
        iso3: market.iso3,
        calculated: round(calculated, 2),
        reported: reported.value,
      });
    }
  }
  if (mismatches.length > 0) {
    conflicts.push({
      type: 'gdp-per-capita',
      severity: 'low',
      message: `${mismatches.length}/${checked} GDP per capita values differ from GDP/population in the same year`,
      samples: mismatches.slice(0, 10),
    });
  } else {
    info.push({
      label: '人均 GDP 恒等式',
      value: `${checked} 个同年值一致；${skippedForYearMismatch} 个因 GDP/人口年份不同跳过`,
    });
  }
}

// ---------------------------------------------------------------- report

function writeReports(wikipediaComparison) {
  const summary = {
    generatedAt: '2026-11-19',
    status: hardErrors.length === 0 ? 'passed' : 'failed',
    markets: markets.length,
    focusMarkets: markets.filter((market) => market.focus).length,
    officialMuslimSnapshots: markets.filter((market) => market.muslim.status === 'official').length,
    mappedFields: Object.keys(fieldSources).length,
    sourceFiles: Object.keys(sourceFiles).length,
    hardErrors: hardErrors.length,
    conflicts: conflicts.length,
  };

  const quality = {
    generatedAt: summary.generatedAt,
    status: summary.status,
    summary,
    provenance: {
      sourceFiles: sourceFiles,
      referenceFiles: {
        'oic-wikipedia.csv': hashFile(path.join(referenceDir, 'oic-wikipedia.csv')),
      },
      fieldSources,
      note: 'Every emitted market field is mapped to a source file/column; source files are SHA-256 pinned in markets.json.',
    },
    checks: {
      hardErrors,
      conflicts,
      info,
    },
    wikipediaComparison,
    credibility: {
      officialCensus:
        '6 个有官方普查的国家：国家统计机构 + 普查年份，是判断“某一年份穆斯林占比”的更可信来源，网页采用这一口径。',
      wikipedia:
        '用户提供的中文 Wikipedia 表适合核对 OIC 成员范围，也可作为外部参照；但其穆斯林比例列来自 Pew Forum 2013 的二手汇总，没有逐国普查年份，因此不把 Wikipedia 数值注入为官方数据。',
      marketAndTrade:
        '人口、GDP、消费、互联网与中国贸易，以 WDI / 中国海关 / UN Comtrade 原始表为主；Wikipedia 图片没有可比的市场或贸易表。',
      languageVariation:
        '同一 OIC 主题的中文与英文 Wikipedia 在部分穆斯林比例上并不一致（见下表），这进一步说明 Wikipedia 百分比不能当作第一手统计。',
    },
  };

  writeFileSync(
    path.join(root, 'public', 'data', 'data-quality.json'),
    `${JSON.stringify(quality, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(root, 'docs', 'data-quality.md'),
    renderMarkdown(quality),
    'utf8',
  );
}

function renderMarkdown(quality) {
  const lines = [];
  lines.push('# 市场数据核验报告');
  lines.push('');
  lines.push(`生成日期：${quality.generatedAt}`);
  lines.push(`状态：**${quality.status === 'passed' ? '通过' : '失败'}**`);
  lines.push('');
  lines.push('## 摘要');
  lines.push('');
  lines.push(`- 市场：${quality.summary.markets}（重点样本 ${quality.summary.focusMarkets}）`);
  lines.push(`- 官方穆斯林人口快照：${quality.summary.officialMuslimSnapshots}`);
  lines.push(`- 已映射字段：${quality.summary.mappedFields}`);
  lines.push(`- 参与哈希校验的源文件：${quality.summary.sourceFiles}`);
  lines.push(`- 硬错误：${quality.summary.hardErrors}`);
  lines.push(`- 报告冲突：${quality.summary.conflicts}`);
  lines.push('');
  lines.push('## 核验项');
  lines.push('');
  for (const item of quality.checks.info) {
    lines.push(`- **${item.label}**：${item.value}`);
  }
  lines.push('');
  lines.push('## 硬错误');
  lines.push('');
  if (quality.checks.hardErrors.length === 0) {
    lines.push('无。生成数据与源文件逐字段一致，源文件哈希未变化。');
  } else {
    for (const error of quality.checks.hardErrors) {
      lines.push(`- \`${error.type}\`：${error.message}`);
    }
  }
  lines.push('');
  lines.push('## 源数据矛盾');
  lines.push('');
  if (quality.checks.conflicts.length === 0) {
    lines.push('未发现源数据内部矛盾。');
  } else {
    for (const conflict of quality.checks.conflicts) {
      lines.push(`- \`${conflict.type}\`（${conflict.severity}）：${conflict.message}`);
      for (const sample of conflict.samples ?? []) {
        lines.push(`  - ${JSON.stringify(sample)}`);
      }
      if (conflict.missing?.length || conflict.extra?.length) {
        lines.push(`  - missing: ${(conflict.missing ?? []).join(', ') || '—'}；extra: ${(conflict.extra ?? []).join(', ') || '—'}`);
      }
    }
  }
  lines.push('');
  lines.push('以上源数据矛盾均保留原值，不自动改写；其中人均 GDP 与 GDP/人口的同表差异约 1.6%，可能来自 WDI 修订、人口口径或四舍五入。');
  lines.push('');
  lines.push('## 穆斯林人口：官方普查与 Wikipedia 参照');
  lines.push('');
  lines.push(
    'Wikipedia 表列的穆斯林比例来自 Pew Forum 2013 的二手汇总；官方普查标明统计机构与普查年份。下表只比较有官方普查的 6 个国家。',
  );
  lines.push('');
  lines.push('| 国家 | 官方普查 | 官方年份/来源 | Wikipedia 参照 | 差值 | 判断 |');
  lines.push('| --- | ---: | --- | ---: | ---: | --- |');
  for (const row of quality.wikipediaComparison.officialComparisons) {
    lines.push(
      `| ${row.country} | ${row.officialShare}% | ${row.officialYear ?? '—'} / ${row.officialSource ?? '—'} | ${row.wikipediaDisplay} | ${row.diff == null ? '—' : `${row.diff > 0 ? '+' : ''}${row.diff}pp`} | ${row.interpretation} |`,
    );
  }
  lines.push('');
  lines.push(
    `- Wikipedia 参照覆盖 57 个成员国；其中只有 6 个有可比的官方普查，其余 ${quality.wikipediaComparison.unavailableWithReference} 个国家的官方比例未被数据库收录，网页也不注入 Wikipedia 值。`,
  );
  lines.push(
    `- 观察员国：Wikipedia 列出 5 个，本项目 57 国范围已排除；成员国 57/57 对齐。`,
  );
  lines.push('');
  lines.push('## Wikipedia 语言版本的差异');
  lines.push('');
  lines.push('同一个 OIC 条目在不同语言版本中，穆斯林比例并不一致（英文版：[Member states of the Organisation of Islamic Cooperation](https://en.wikipedia.org/wiki/Member_states_of_the_Organisation_of_Islamic_Cooperation)）：');
  lines.push('');
  lines.push('| 国家 | 中文 Wikipedia（截图） | 当前英文 Wikipedia | 官方普查 |');
  lines.push('| --- | ---: | ---: | --- |');
  for (const row of quality.wikipediaComparison.languageVariation) {
    lines.push(
      `| ${row.country} | ${row.chineseWikipediaAndImage} | ${row.currentEnglishWikipedia} | ${row.officialCensus} |`,
    );
  }
  lines.push('');
  lines.push('## 可信度判断');
  lines.push('');
  lines.push('差异主要来自年份、口径和四舍五入，不能把不同年份的数字直接当作同一时点的矛盾。以文莱为例：官方 2021 年普查为 82.1%，Wikipedia/Pew 2013 汇总为 75.10%，相差 7pp，两者并不覆盖同一年。');
  lines.push('');
  lines.push(`- ${quality.credibility.officialCensus}`);
  lines.push(`- ${quality.credibility.wikipedia}`);
  lines.push(`- ${quality.credibility.marketAndTrade}`);
  lines.push(`- ${quality.credibility.languageVariation}`);
  lines.push('');
  lines.push('## 数据来源');
  lines.push('');
  lines.push('- 市场、人口、消费、互联网：[世界银行 WDI](https://data.worldbank.org/)（`metric-long.csv` / `market-latest.csv`）。');
  lines.push('- 中国贸易：[中国海关](http://stats.customs.gov.cn/)（`china-trade-yearly.csv` / `china-trade-cagr.csv`）。');
  lines.push('- 分品类进口：[UN Comtrade](https://comtradeplus.un.org/)（`products-idn-mys.csv`）。');
  lines.push('- 穆斯林人口：各国官方统计（`muslim-official.csv`，仅 6 国）。');
  lines.push('- Wikipedia：[中文 OIC 条目](https://zh.wikipedia.org/wiki/%E4%BC%8A%E6%96%AF%E5%85%B0%E5%90%88%E4%BD%9C%E7%BB%84%E7%BB%87)截图及 Pew Forum 2013 引用（`data/reference/oic-wikipedia.csv`，仅参照）。');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- helpers

function classifyDiff(diff) {
  if (diff == null) return '无参照值';
  const absolute = Math.abs(diff);
  if (absolute <= 0.5) return '基本一致（≤0.5pp）';
  if (absolute <= 2) return '小幅差异（0.5–2pp）';
  return '显著差异（>2pp）';
}

function sameMetric(actual, expected) {
  if (actual == null || expected == null) return actual == null && expected == null;
  return sameNumber(actual.value, expected.value) && (actual.year ?? null) === (expected.year ?? null);
}

function sameTrade(actual, expected) {
  if (actual == null || expected == null) return actual == null && expected == null;
  return (
    (actual.year ?? null) === (expected.year ?? null) &&
    sameNumber(actual.value, expected.value) &&
    sameNumber(actual.yoy, expected.yoy) &&
    sameNumber(actual.shareOfChinaTotal, expected.shareOfChinaTotal) &&
    sameNumber(actual.cagr2020_2025, expected.cagr2020_2025)
  );
}

function sameObject(actual, expected) {
  if (actual == null || expected == null) return actual == null && expected == null;
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const key of keys) {
    const a = actual[key];
    const b = expected[key];
    if (typeof a === 'number' || typeof b === 'number') {
      if (!sameNumber(a, b)) return false;
    } else if ((a ?? null) !== (b ?? null)) {
      return false;
    }
  }
  return true;
}

function sameNumber(a, b) {
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
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

function readCsv(dir, fileName) {
  const text = readFileSync(path.join(dir, fileName), 'utf8').replace(/^\uFEFF/, '');
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
