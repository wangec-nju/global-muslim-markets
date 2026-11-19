# Global Muslim Markets · OIC 市场探索器

基于 **globe.gl** 的 3D 市场探索器：地球只渲染 **OIC 57 个市场**，只有这些国家有高亮边界、可以悬停和点击。卡片不展示首都、面积等国家资料，只展示市场规模、中国贸易、穆斯林人口（仅官方普查）和代表进口品类。

**卡片外壳（位置、悬停、固定、关闭、焦点）与卡片内容渲染解耦**，内容层可以在不改动外壳的情况下替换成其他市场视图。

线上地址：**https://wangec-nju.github.io/global-muslim-markets/**

![OIC 市场卡片与高亮边界](docs/preview.png)

---

## 功能

- **3D 地球**：globe.gl + three.js，OIC 市场边界使用 50m 世界边界数据，包含巴林、科摩罗、马尔代夫等小岛国。
- **只渲染 57 个 OIC 市场**：非 OIC 国家没有国家面、没有边界、不可交互，只保留地球底图。
- **双色高亮**：16 个重点样本用金色边界，其余 41 个 OIC 市场用青绿色边界；悬停/选中时变为更亮的金色。
- **悬停预览、点击固定**：预览为紧凑卡片；固定后展示完整指标、贸易明细、穆斯林人口和代表品类，镜头飞向该国。
- **市场数据而非国家概况**：没有首都、面积、区域、ISO 信息；卡片标题仅保留国旗与中英文名称用于识别。
- **数据缺口显式呈现**：缺失值显示 `—`，不补零、不前填；穆斯林人口仅 6 个有官方普查快照的国家显示，其余明确写“不据此推断”。
- **响应式**：桌面为跟随指针的浮层；≤700px 为底部卡片，预览态不拦截点击。
- **工程化**：Vite + TypeScript strict、24 个测试、GitHub Pages 自动部署。

---

## 快速开始

需要 Node.js **22.12+**。

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 24 个测试
npm run build
npm run preview
```

---

## 数据

### 来源与结构化

原始数据来自 `数据.zip`。仓库只提交**经过筛选的源表**（`data/source/`，约 700KB），不提交 12MB 的原始压缩包和 PDF。

| 文件 | 用途 |
| --- | --- |
| `data/source/scope.csv` | OIC 57 国研究范围、UN M49 代码、16 国重点标记 |
| `data/source/market-latest.csv` | 各国市场规模指标最新可得值 |
| `data/source/muslim-official.csv` | 已核实的穆斯林人口/占比官方普查快照 |
| `data/source/china-trade-yearly.csv` | 2021—2025 中国对各市场进出口、同比、占比 |
| `data/source/china-trade-cagr.csv` | 2020—2025 五年 CAGR |
| `data/source/products-idn-mys.csv` | 印度尼西亚、马来西亚代表品类进口（2021—2025） |
| `data/source/product-meta.csv` | HS 编码的中文名称与品类 |
| `data/source/wdi-dictionary.csv` | WDI 指标口径与质量说明 |
| `data/source/metric-long.csv` | WDI 长表，用于对宽表做逐项交叉核验 |
| `data/reference/oic-wikipedia.csv` | Wikipedia OIC 成员/观察员、加入年份、穆斯林比例参照（**不注入卡片**） |

生成结构化数据：

```bash
npm run gen:markets
```

产物是 `public/data/markets.json`，由脚本校验并写入：

- 57 个市场，16 个重点样本；
- 6 个有官方穆斯林人口普查快照的国家；
- 2 个有代表品类数据的国家（IDN / MYS）；
- 每个市场都有 2025 年中国出口与进口流。

### 来源追溯与核验

`public/data/markets.json` 的 `meta` 里带有：

- `sourceFiles`：9 个源 CSV 的 SHA-256，生成后源文件一旦变化，审计立即失败；
- `fieldSources`：39 个字段到源文件/列的映射；
- 每个市场的 `sourceRow`：`scope.csv#IDN`、`market-latest.csv#IDN`、`china-trade-yearly.csv#IDN/X,M/2025` 等行级定位；
- 卡片每个板块通过 `title` 提示对应的源文件，例如“市场基本面”对应 `market-latest.csv`。

运行完整审计：

```bash
npm run audit:markets
```

输出：

- [docs/data-quality.md](docs/data-quality.md)：人读的核验报告；
- [public/data/data-quality.json](public/data/data-quality.json)：机器可读的核验结果（随 GitHub Pages 发布）。

本次结果：

- **0 个硬错误**：57 个市场逐字段与源文件一致，9 个源文件哈希未变化；
- 798 个市场指标、114 个中国贸易流全部复算一致；
- 452 个同比、114 个 CAGR 全部与源表公式一致；
- 宽表与 WDI 长表 **798 项一致**；
- OIC 成员 **57/57** 与 Wikipedia 参照一致，5 个观察员国已排除；
- 3 个低严重度差异，均保留原值并在报告中列出：
  - **源表内部**：摩洛哥同年人均 GDP 的源表值 4,672.47 美元，与 GDP/人口 4,745.53 美元相差约 1.6%；
  - **Wikipedia 同一页面**：用户给出的英文 OIC 主页面导言称 48 个穆斯林多数国，Members 段却列出 8 个非穆斯林多数国（57−8=49），页面内部矛盾；
  - **Wikipedia 参照**：文莱官方 2021 普查 **82.1%** vs Wikipedia/Pew 2013 **75.10%**（相差 7pp，年份不同，不能当作同一时点矛盾）。

### Wikipedia 参照与可信度

用户给出的英文主页面 [Organisation of Islamic Cooperation](https://en.wikipedia.org/wiki/Organisation_of_Islamic_Cooperation) 的 Members 段确认 57 国/5 观察员国，但**没有**截图中的加入年份与比例表，而是链接到单独的 Member states 条目；截图表格实际对应中文 OIC 条目。中文表的穆斯林比例列引用 **Pew Forum 2013 的二手汇总**，没有逐国普查年份，并含 `>99.0%`、`~6.4%` 等区间/约数；当前英文 Member states 表与中文表也不一致（孟加拉国 92% vs 89.80%，文莱 84% vs 75.10%，哈萨克斯坦 74% vs 70.40%）。

因此：

- **官方普查优先**：6 个有国家统计机构 + 普查年份的国家，网页采用官方值；Wikipedia 不替换、不补值。
- **Wikipedia 只做范围和参照**：用于验证 57 个成员国、5 个观察员国的范围，以及作为外部对照；不把 Wikipedia 百分比注入为官方数据。
- **市场与贸易以原始表为主**：WDI、中国海关、UN Comtrade 是卡片中市场/贸易字段的来源；Wikipedia 图片没有可比的市场或贸易数据。

参照文件和说明见 [data/reference/README.md](data/reference/README.md)。

### 字段

```ts
type MarketCountry = {
  id: string;        // UN M49，三位，与地图边界 id 对齐
  iso3: string;
  nameZh: string;
  nameEn: string;
  flag: string | null;
  focus: boolean;
  metrics: {
    population, populationGrowth, urbanShare, youthShare,
    workingAgeShare, seniorShare, gdp, gdpPerCapita,
    gniPerCapita, householdConsumption,
    householdConsumptionPerCapita, internetPenetration,
    goodsExports, goodsImports // MetricValue | null
  };
  muslim: {
    status: 'official' | 'unavailable';
    share: number | null;
    population: number | null;
    year: string | null;
    source: string | null;
    note: string | null;
  };
  chinaTrade: {
    year: string;
    exports: TradeFlow | null; // 中国对该市场出口（X）
    imports: TradeFlow | null; // 中国从该市场进口（M）
  };
  products: ProductImport[]; // 仅 IDN / MYS
};
```

每个指标都带自己的年份，因为世界银行不同指标的最新可得年份不同（例如互联网普及率可能停留在 2024，人口/GDP 为 2025）。

### 口径与限制

- **OIC 57 国不等于 57 个穆斯林人口占多数的国家**。研究范围来自 OIC 成员样本；穆斯林人口只按官方普查展示。
- **国家总体指标不是穆斯林专属口径**：人口、GDP、家庭消费、互联网普及率覆盖全国全部人口与经济。
- **缺失值不补零、不前填**。苏里南的家庭消费等缺值会显示为 `—`。
- **穆斯林人口只收录 6 国官方普查快照**：孟加拉国、文莱、印度尼西亚、哈萨克斯坦、马来西亚、巴基斯坦；其余明确标注“未取得已核实的官方宗教统计，不据此推断”。
- **代表品类是研究筛选口径，不是清真认证目录**。HS 数据仅覆盖印度尼西亚、马来西亚，缺失的中国进口记录不置零。
- **中国贸易方向**：`exports` 表示中国对目标市场出口，`imports` 表示中国从目标市场进口。

---

## 架构与解耦

```
指针
 │
 ▼
GlobeScene ──► { country, point } ──► app.ts ──► MarketRepository
（只拿到 57 个形状）                   （组合根）        │
 │                                                   ▼
 ▼                                             MarketCountry
高亮 / 选中 / 镜头                                   │
                                                     ▼
                                            CardController（卡片外壳）
                                                     │
                                                     ▼
                                            createMarketRenderer()
```

三条边界：

1. **`src/globe/` 不知道市场数据。** 它只接收 57 个 `CountryShape`，发出悬停/点击事件，负责样式、选中和镜头。
2. **`src/data/MarketRepository.ts` 不碰 DOM。** 它加载并索引 `markets.json`，用 UN M49 / ISO3 / 英文名把地图形状解析成 `MarketCountry`。
3. **`src/card/CardController.ts` 不知道卡片内容。** 它只处理外壳、位置、预览/固定、Esc、焦点和指针驻留；内容由注入的 `CardContentRenderer` 返回 DOM。

`src/app.ts` 是唯一组合根；只有加载到市场数据的 57 个形状会交给 globe，因此“只显示、只交互 OIC 市场”是由数据层保证的，而不是靠样式隐藏。

### 目录

```
data/source/               # 结构化前的精选 CSV（可复现）
public/data/markets.json   # 生成的市场数据（唯一运行时数据）
scripts/build-market-data.mjs
src/
├─ app.ts                  # 组合根、57 国过滤、悬停/固定接线
├─ config.ts               # 初始视角、纹理、市场数据地址
├─ globe/
│  ├─ GlobeScene.ts        # 边界样式、focusIds、悬停/点击/镜头
│  └─ geo.ts               # TopoJSON → CountryShape（50m）
├─ data/
│  ├─ MarketRepository.ts  # 加载、索引、resolve(shape)
│  ├─ types.ts             # MarketCountry / TradeFlow / ...
│  └─ format.ts            # 人口、美元、百分比、贸易份额格式化
├─ card/
│  ├─ CardController.ts    # 卡片外壳
│  ├─ registry.ts          # 内容渲染器注册表（market）
│  └─ renderers/market.ts  # 市场卡片内容
└─ styles/                 # tokens/base/globe/chrome/card/loader
```

### 新增卡片内容

内容渲染器只需要返回一个元素：

```ts
export interface CardContentRenderer {
  id: string;
  create(ctx: {
    country: MarketCountry;
    mode: 'preview' | 'pinned';
    actions: { close(): void; pin(): void };
  }): {
    element: HTMLElement;
    update?(ctx): void;
    destroy?(): void;
  };
}
```

1. 在 `src/card/renderers/` 添加渲染器；
2. 在 `src/card/registry.ts` 注册；
3. 在 `src/config.ts` 指向新的 `cardRenderer`。外壳无需改动。

---

## 配置

`src/config.ts`：

```ts
cardRenderer: 'market',
globe: {
  textureUrl: publicAsset('textures/earth-night.jpg'),
  bumpTextureUrl: publicAsset('textures/earth-topology.png'),
  initialView: { lat: 22, lng: 52, altitude: 2.0 },
  autoRotate: true,
  autoRotateSpeed: 0.3,
},
data: {
  marketUrl: publicAsset('data/markets.json'),
},
```

- 资源路径统一经过 `publicAsset()`，自动带 Vite `BASE_URL`。
- 如需调整重点国家，修改 `data/source/scope.csv` 的 `16国重点样本` 后重新生成；全局计数自动更新。
- 减少动态效果：遵循 `prefers-reduced-motion`。

---

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 后：

1. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**（首次一次性）；
2. Actions 运行 `npm ci` → `npm test` → `npm run build`；
3. 自动计算项目页 base 为 `/<repo>/`，上传 `dist/`；
4. 访问 `https://wangec-nju.github.io/global-muslim-markets/`。

绑定自定义域名时，在仓库 **Settings → Secrets and variables → Actions → Variables** 添加 `VITE_BASE=/`，然后重新运行部署。

本地模拟子路径：

```bash
export VITE_BASE=/global-muslim-markets/
npm run build
npm run preview
# http://127.0.0.1:4173/global-muslim-markets/
```

---

## 测试

```bash
npm test
```

覆盖：

- 50m 边界解析、无 ISO id 地区的稳定回退；
- 市场形状按 UN M49 / ISO3 / 英文名解析；
- 57 个市场、16 个重点样本；
- 缺失值保持 `null`；
- 仅 6 个官方穆斯林人口快照；
- 每个市场都有 2025 中国贸易流；
- 代表品类仅 IDN / MYS；
- 卡片定位翻转与渲染器回退；
- 数据源哈希、39 个字段的来源映射、逐字段与源表一致（`npm run audit:markets`）。

---

## 已知限制

- **小岛国**：巴林、科摩罗、马尔代夫等 50m 几何很小，需要放大后点击；没有额外的搜索/列表入口。
- **年份不统一**：不同指标按各自最新可得年份展示，跨指标比较需看卡片中的年份标签。
- **穆斯林人口覆盖有限**：只有 6 国官方普查；其余不推断。
- **代表品类覆盖有限**：仅 IDN / MYS；品类为研究口径，不是清真认证目录。
- **包体**：主 chunk 约 820KB gzip；地球纹理约 240KB，异步加载，不阻塞地球首帧。
- **CDN 缓存**：GitHub Pages 首次加载受网络影响；资源带 hash，后续命中缓存。

---

## 数据与素材说明

- 市场规模、人口、消费、互联网：世界银行 WDI（2020—2025 最新可得值）。
- 中国贸易：中国海关年度数据（2020—2025）。
- 分品类进口：UN Comtrade（印度尼西亚、马来西亚，2021—2025）。
- OIC 57 国范围：SESRIC / OIC 研究样本。
- 穆斯林人口：仅各国官方统计机构已核实的普查快照。
- Wikipedia 参照：[中文 OIC 条目](https://zh.wikipedia.org/wiki/%E4%BC%8A%E6%96%AF%E5%85%B0%E5%90%88%E4%BD%9C%E7%BB%84%E7%BB%87)（截图 + Pew Forum 2013 引用）；仅用于核验，不注入卡片。
- 地理边界：[world-atlas](https://github.com/topojson/world-atlas)（ISC，50m；数据源 Natural Earth，公有领域）。
- 国家英文名/旗帜：[world-countries](https://github.com/mledoze/countries)（ODbL-1.0；仅用于名称与旗帜，不生成国家概况数据）。
- 地球夜景/地形纹理：来自 [three-globe](https://github.com/vasturiano/three-globe) 示例素材（NASA Earth 影像，公有领域）。
