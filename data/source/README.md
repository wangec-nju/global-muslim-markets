# Market source tables

These CSVs are the curated inputs for `npm run gen:markets`. They were extracted from the provided `数据.zip`; the 12 MB archive itself (including the 11 MB PDF) is intentionally not committed.

| File | Original table | Purpose |
| --- | --- | --- |
| `scope.csv` | `00_国家与指标字典/57国研究范围.csv` | 57-market scope, UN M49 ids, 16 focus flags |
| `market-latest.csv` | `01_市场规模与结构/00_57国基础对比_各指标最新年份.csv` | latest available market metrics and their years |
| `muslim-official.csv` | `01_市场规模与结构/06_穆斯林人口与占比_官方历史快照.csv` | verified official census snapshots only |
| `china-trade-yearly.csv` | `02_中国与目标市场贸易/04_年度同比与中国贸易占比.csv` | 2021–2025 China trade by market/direction |
| `china-trade-cagr.csv` | `02_中国与目标市场贸易/05_复合增长率.csv` | 2020–2025 five-year CAGR |
| `products-idn-mys.csv` | `03_分商品贸易/02_代表HS6进口需求与中国份额.csv` | representative product imports for IDN/MYS |
| `product-meta.csv` | `00_国家与指标字典/既有代表产品清单_非完整认证目录.csv` | Chinese HS labels and categories |
| `wdi-dictionary.csv` | `00_国家与指标字典/WDI指标字典.csv` | WDI definitions and quality notes |
| `metric-long.csv` | `01_市场规模与结构/05_各国各指标最新可得值.csv` | long WDI table used to cross-check the wide table |

## Rules applied by the generator

- Empty values stay `null`; no forward fill and no zero substitution.
- The scope is the OIC 57-market research sample, not a claim that all 57 are Muslim-majority.
- Muslim population is only emitted for the six countries with a verified official census snapshot; all others are marked unavailable.
- `chinaTrade.exports` is China's export flow (X); `chinaTrade.imports` is China's import flow (M).
- Representative product imports are limited to Indonesia and Malaysia and are a research screening scope, not a halal certification list.

Run `npm run audit:markets` to verify every generated value against these tables, check the formulas, and compare the six official Muslim snapshots with the Wikipedia reference in `data/reference/`.

Country-profile data sources and caveats: see [profile-sources.md](profile-sources.md).
