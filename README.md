# Global Muslim Markets · OIC 市场探索器

基于 **globe.gl** 的 3D 市场探索器：地球渲染 **OIC 57 个市场**与红色中国；OIC 市场可悬停预览、点击打开完整档案；中国仅悬停。页面支持**默认 / 悬停 / 点击侧栏 / 全量搜索**四种形态，并补充语言、行政区、城市、机场/港口/物流枢纽、HS2 与对华贸易联系。

**卡片、完整侧栏、搜索与地球场景解耦**：卡片只承载悬停摘要；侧栏承载完整国家档案；搜索索引全部档案；地球场景只负责边界、枢纽点与贸易弧线。

线上地址：**https://wangec-nju.github.io/global-muslim-markets/**

![完整国家档案侧栏与 OIC 边界](docs/preview.png)

---

## 功能

- **3D 地球**：globe.gl + three.js，OIC 市场边界使用 50m 世界边界数据，包含巴林、科摩罗、马尔代夫等小岛国。
- **只渲染 57 个 OIC 市场**：非 OIC 国家没有国家面、没有边界、不可交互，只保留地球底图。
- **双色高亮**：16 个重点样本用金色边界，其余 41 个 OIC 市场用青绿色边界；悬停/选中时变为更亮的金色。
- **四种形态**：默认地球；悬停摘要卡（国旗、官方/常用语言、市场概览、行政区与枢纽预览）；点击右侧完整侧栏；全量搜索（国家、城市、语言、行政区、机场/港口/物流枢纽、HS2）。
- **中国特殊**：红色高亮，**仅悬停**；悬浮面板展示 34 个省级行政区、机场/港口/物流枢纽与对穆斯林市场的贸易联系；不进入点击侧栏和搜索。
- **连接线**：按 2025 年中国进出口额绘制示意弧线，明确标注“贸易流示意，非实际航道”。
- **数据缺口显式呈现**：缺失值显示 `—`，不补零、不前填；HS2 有 46 个 OIC 市场 + 中国；阿尔及利亚为 2024 年，其余 11 个市场无可用数据，不补。
- **清晰度**：地球夜景纹理升级为 4096×2048；卡片/侧栏为玻璃层，不遮挡地球。
- **响应式**：桌面为跟随指针的摘要卡 + 右侧档案；≤700px 侧栏全屏，预览态不拦截点击。
- **工程化**：Vite + TypeScript strict、29 个测试、GitHub Pages 自动部署。

---

## 快速开始

需要 Node.js **22.12+**。

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 29 个测试
npm run gen:profiles  # 重建国家档案
npm run build
npm run preview
```

---

## 数据

### 来源与结构化

原始数据来自 `数据.zip`。仓库只提交**经过筛选的源表**（`data/source/`，约 1.3MB），不提交 12MB 的原始压缩包和 PDF。

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
| `data/source/profiles-factbook.csv` | CIA World Factbook 常用语言 |
| `data/source/geo/` | GeoNames 一级行政区/城市、OurAirports 机场、WPI 港口、Wikidata 城市中文名 |
| `data/source/hs2-imports.csv` | UN Comtrade HS2 进口结构（46 个 OIC 市场 + 中国；阿尔及利亚 2024） |
| `data/source/china-*.csv` | 中国 34 个省级行政区、城市与枢纽整理 |
| `public/flags/` | 58 张本地国旗 PNG（与 `profiles.json` 的 `flagUrl` 对应） |

生成结构化数据：

```bash
npm run gen:markets
npm run gen:profiles
```

产物是 `public/data/markets.json` 与 `public/data/profiles.json`，由脚本校验并写入：

- 57 个市场，16 个重点样本；
- 6 个有官方穆斯林人口普查快照的国家；
- 2 个有代表品类数据的国家（IDN / MYS）；
- 每个市场都有 2025 年中国出口与进口流；
- 58 个国家档案（57 个市场 + 中国），含语言、行政区、城市、机场/港口/物流枢纽、HS2 与 Wikipedia 链接。

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

用户给出的英文主页面 [Organisation of Islamic Cooperation](https://en.wikipedia.org/wiki/Organisation_of_Islamic_Cooperation) 的 Members 段确认 57 国/5 观察员国，但**没有**截图中的加入年份与比例表，而是链接到单独的 Member states 条目；截图表格实际对应中文 OIC 条目。中文表的穆斯林比例列引用 **Pew Forum 2010 年估计表（Wikipedia 于 2013 年引用）**，没有逐国普查年份，并含 `>99.0%`、`~6.4%` 等区间/约数；当前英文 Member states 表与中文表也不一致（孟加拉国 92% vs 89.80%，文莱 84% vs 75.10%，哈萨克斯坦 74% vs 70.40%）。

已直接核验 Wikipedia 引用的 Pew 原始表及存档 PDF：6 个有官方普查的抽样值全部与 Pew 2010 表一致；但该表是 **2010 年估计**，且加入年份列没有引用，属于 Wikipedia 自身元数据。

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
3. **`src/card/CardController.ts` 不知道卡片内容。** 它只处理外壳、位置、悬停预览、Esc、焦点和指针驻留；内容由注入的 `CardContentRenderer` 返回 DOM。

`src/app.ts` 是唯一组合根；只有加载到市场数据的 57 个形状会交给 globe，因此“只显示、只交互 OIC 市场”是由数据层保证的，而不是靠样式隐藏。

### 目录

```
data/source/               # 结构化前的精选 CSV（可复现）
public/data/markets.json   # 生成的市场数据（唯一运行时数据）
scripts/build-market-data.mjs
src/
├─ app.ts                  # 组合根、57 国过滤、悬停/侧栏/搜索接线
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
  profileUrl: publicAsset('data/profiles.json'),
},
```

- 资源路径统一经过 `publicAsset()`，自动带 Vite `BASE_URL`。
- 如需调整重点国家，修改 `data/source/scope.csv` 的 `16国重点样本` 后重新生成；全局计数自动更新。
- 减少动态效果：遵循 `prefers-reduced-motion`。

---

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 后：

1. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**（首次一次性）；
2. Actions 运行 `npm ci` → `npm test` → `npm run audit:markets` → `npm run build`；
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
- 缺失值保持 `null`；仅 6 个官方穆斯林人口快照；
- 每个市场都有 2025 中国贸易流；
- 58 个国家档案：57 个市场 + 中国；中国 34 个省级行政区；
- 城市中文名覆盖率、58 张本地国旗、HS2 不伪造缺失；
- 卡片定位翻转、侧栏与搜索不依赖地球内部状态；
- 数据源哈希、39 个字段的来源映射、逐字段与源表一致（`npm run audit:markets`）。

---

## 已知限制

- **小岛国**：巴林、科摩罗、马尔代夫等 50m 几何很小，需要放大后点击；现在可以用搜索直接打开。
- **年份不统一**：不同指标按各自最新可得年份展示；HS2 为 2023 年（阿尔及利亚为 2024 年），市场指标多为 2025 年。
- **穆斯林人口覆盖有限**：只有 6 国官方普查；其余不推断。
- **行政/城市/枢纽覆盖**：行政区为 GeoNames 一级名称，不含边界几何；城市中文名 338/338；枢纽为筛选样本；物流枢纽采用 UN/LOCODE 铁路/公路终端，不是仓库面。
- **HS2 覆盖**：46 个 OIC 市场 + 中国；阿尔及利亚为 2024 年；11 个市场无可用数据，留空。
- **航线**：UN Comtrade 只有贸易额，弧线是示意，不是实际航道。
- **包体**：主 chunk 约 830KB gzip；地球纹理约 493KB，异步加载，不阻塞地球首帧。
- **CDN 缓存**：GitHub Pages 首次加载受网络影响；资源带 hash，后续命中缓存。

---

## 数据与素材说明

- 市场规模、人口、消费、互联网：世界银行 WDI（2020—2025 最新可得值）。
- 中国贸易：中国海关年度数据（2020—2025）。
- 分品类进口：UN Comtrade（印度尼西亚、马来西亚，2021—2025）。
- 国家档案：world-countries（国旗/官方语言/首都/面积/货币/区号）、CIA World Factbook（常用语言）、GeoNames（一级行政区/城市）、Wikidata（城市中文名）、OurAirports（机场）、NGA World Port Index（港口）、UN/LOCODE（铁路/公路物流枢纽）、UN Comtrade（HS2 2023/2024）。
- 中国省级行政区/城市/枢纽：项目整理；详见 [data/source/profile-sources.md](data/source/profile-sources.md)。
- OIC 57 国范围：SESRIC / OIC 研究样本。
- 穆斯林人口：仅各国官方统计机构已核实的普查快照。
- Wikipedia 参照：[中文 OIC 条目](https://zh.wikipedia.org/wiki/%E4%BC%8A%E6%96%AF%E5%85%B0%E5%90%88%E4%BD%9C%E7%BB%84%E7%BB%87)（截图 + Pew Forum 2010 年估计，2013 存档）；仅用于核验，不注入卡片。
- 地理边界：[world-atlas](https://github.com/topojson/world-atlas)（ISC，50m；数据源 Natural Earth，公有领域）。
- 国家英文名/旗帜：[world-countries](https://github.com/mledoze/countries)（ODbL-1.0；仅用于名称与旗帜，不生成国家概况数据）。
- 地球夜景/地形纹理：来自 [three-globe](https://github.com/vasturiano/three-globe) 示例素材（NASA Earth 影像，公有领域）；夜景纹理为 4096×2048。
