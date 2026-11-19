# 市场数据核验报告

生成日期：2026-11-19
状态：**通过**

## 摘要

- 市场：57（重点样本 16）
- 官方穆斯林人口快照：6
- 已映射字段：39
- 参与哈希校验的源文件：9
- 硬错误：0
- 报告冲突：3

## 核验项

- **源文件**：9 个源 CSV 已计算 SHA-256；Wikipedia 参照 SHA-256 f73b47181c23…，页面核验 62f8fd333e8e…，Pew 核验 a90b81662b6a…
- **市场指标**：798 项（23 项为空）
- **中国贸易流**：114 条
- **官方穆斯林快照**：6 个
- **WDI 宽表/长表**：798 项一致
- **贸易同比公式**：452 条一致
- **贸易 CAGR 公式**：114 条一致
- **贸易占比分母**：无法复算：源表没有中国总额行；保留源表值
- **OIC 成员范围**：57/57 与 Wikipedia 参照一致
- **观察员国**：5 个观察员国已正确排除在 57 国范围之外
- **官方与 Wikipedia 比较**：6 个官方普查与参照比较；51 个市场只有 Wikipedia/Pew 参照
- **Pew 引用源**：6/6 个抽样值与 Pew 2010 表一致；加入年份列无引用

## 硬错误

无。生成数据与源文件逐字段一致，源文件哈希未变化。

## 源数据矛盾

- `gdp-per-capita`（low）：1/52 个同年人均 GDP 源表值与 GDP/人口 不一致
  - {"iso3":"MAR","calculated":4745.53,"reported":4672.46826171875}
- `wikipedia-page`（low）：英文 OIC 主页面内部不一致：导言称 48 个穆斯林多数国，Members 段列出 8 个非穆斯林多数国（57 国总数隐含 49 个）。
  - {"lead":48,"membersMinusNonMajority":49,"members":57}
- `wikipedia-muslim-share`（low）：文莱：官方 82.1%（2021）vs Wikipedia 75.10%，相差 7pp
  - {"iso3":"BRN","official":"82.1% (2021)","wikipedia":"75.10%","diff":"7pp"}

以上源数据矛盾均保留原值，不自动改写；其中人均 GDP 与 GDP/人口的同表差异约 1.6%，可能来自 WDI 修订、人口口径或四舍五入。

## Wikipedia 页面核验

- 用户提供的英文主页面：[https://en.wikipedia.org/wiki/Organisation_of_Islamic_Cooperation](https://en.wikipedia.org/wiki/Organisation_of_Islamic_Cooperation)
  - Members 段确认 57 个成员国、5 个观察员国；
  - **没有**加入年份或穆斯林比例表，只有成员列表，并链接到单独的 Member states 条目；
  - 导言称 48 个穆斯林多数国，Members 段却列出 8 个非穆斯林多数国，隐含 49 个，页面内部不一致。
- 截图中的加入年份/比例表与[中文 OIC 条目](https://zh.wikipedia.org/wiki/%E4%BC%8A%E6%96%AF%E5%85%B0%E5%90%88%E4%BD%9C%E7%BB%84%E7%BB%87)匹配，比例列引用 Pew Forum 2010 年估计表（2013 存档）；
- [英文 Member states 条目](https://en.wikipedia.org/wiki/Member_states_of_the_Organisation_of_Islamic_Cooperation)另有比例表，但数值与截图不同（孟加拉国 92%、文莱 84%、哈萨克斯坦 74%）。

## Wikipedia 引用源核验

- 引用：Pew Forum on Religion & Public Life, Global Religious Landscape: Table: Religious Composition by Country (2010 estimates)；
- 原文：[Pew 2010 表](http://www.pewforum.org/uploadedFiles/Topics/Religious_Affiliation/globalReligion-tables.pdf)，[存档 PDF](https://web.archive.org/web/20130309232331/http://www.pewforum.org/uploadedFiles/Topics/Religious_Affiliation/globalReligion-tables.pdf)，PDF SHA-256 `1d3f0516542c7931…`；
- 抽样 6 个有官方普查的国家，Wikipedia 比例与 Pew 2010 表全部一致：孟加拉国 89.80%、文莱 75.10%、印度尼西亚 87.20%、哈萨克斯坦 70.40%、马来西亚 63.70%、巴基斯坦 96.40%；
- Pew 表为 **2010 年估计**，只给一位小数；Wikipedia 部分行为两位小数或 `>99.0%`，属于舍入/表达差异；
- **加入年份列没有引用**：中文 Wikipedia 表只给穆斯林比例列挂了 Pew 来源，加入年份未给出处；
- 结论：所引 Pew 来源真实存在且有存档，2010 年表支持抽样的 Wikipedia 比例值。Pew 是可信的研究机构，但这是 2010 年估计，不是当前全国普查；比例列可追溯，加入年份列不在该引用范围内。对“某一年份的全国穆斯林占比”，官方普查仍是更强的来源。

## 穆斯林人口：官方普查与 Wikipedia 参照

Wikipedia 表列的穆斯林比例来自 Pew Forum 2010 年估计表（页面于 2013 年引用存档）；官方普查标明统计机构与普查年份。下表只比较有官方普查的 6 个国家。

| 国家 | 官方普查 | 官方年份/来源 | Wikipedia 参照 | 差值 | 判断 |
| --- | ---: | --- | ---: | ---: | --- |
| 孟加拉国 | 91.04% | 2022 / 孟加拉国统计局BBS | 89.80% | +1.24pp | 小幅差异（0.5–2pp） |
| 文莱 | 82.1% | 2021 / 文莱经济规划与统计局DEPS | 75.10% | +7pp | 显著差异（>2pp） |
| 印度尼西亚 | 87.18% | 2010 / 印度尼西亚宗教事务部引用BPS2010人口普查 | 87.20% | -0.02pp | 基本一致（≤0.5pp） |
| 哈萨克斯坦 | 69.3% | 2021 / 哈萨克斯坦国家统计局 | 70.40% | -1.1pp | 小幅差异（0.5–2pp） |
| 马来西亚 | 63.5% | 2020 / 马来西亚统计局DOSM | 63.70% | -0.2pp | 基本一致（≤0.5pp） |
| 巴基斯坦 | 96.35% | 2023 / 巴基斯坦统计局PBS | 96.40% | -0.05pp | 基本一致（≤0.5pp） |

- Wikipedia 参照覆盖 57 个成员国；其中只有 6 个有可比的官方普查，其余 51 个国家的官方比例未被数据库收录，网页也不注入 Wikipedia 值。
- 观察员国：Wikipedia 列出 5 个，本项目 57 国范围已排除；成员国 57/57 对齐。

## Wikipedia 语言版本的差异

同一个 OIC 条目在不同语言版本中，穆斯林比例并不一致（英文版：[Member states of the Organisation of Islamic Cooperation](https://en.wikipedia.org/wiki/Member_states_of_the_Organisation_of_Islamic_Cooperation)）：

| 国家 | 中文 Wikipedia（截图） | 当前英文 Wikipedia | 官方普查 |
| --- | ---: | ---: | --- |
| 孟加拉国 | 89.80% | 92% | 91.04% (2022, BBS) |
| 文莱 | 75.10% | 84% | 82.1% (2021, DEPS) |
| 哈萨克斯坦 | 70.40% | 74% | 69.3% (2021, Bureau of National Statistics) |

## 可信度判断

差异主要来自年份、口径和四舍五入，不能把不同年份的数字直接当作同一时点的矛盾。以文莱为例：官方 2021 年普查为 82.1%，Wikipedia/Pew 2013 汇总为 75.10%，相差 7pp，两者并不覆盖同一年。

- 6 个有官方普查的国家：国家统计机构 + 普查年份，是判断“某一年份穆斯林占比”的更可信来源，网页采用这一口径。
- 用户提供的中文 Wikipedia 表适合核对 OIC 成员范围，也可作为外部参照；但其穆斯林比例列来自 Pew Forum 2010 年估计表（2013 存档），没有逐国普查年份，因此不把 Wikipedia 数值注入为官方数据。
- 人口、GDP、消费、互联网与中国贸易，以 WDI / 中国海关 / UN Comtrade 原始表为主；Wikipedia 图片没有可比的市场或贸易表。
- 同一 OIC 主题的中文与英文 Wikipedia 在部分穆斯林比例上并不一致（见下表）；英文主页面自身还把穆斯林多数国写成 48 个，而其 Members 段列出 8 个非穆斯林多数国（57−8=49）。这些页面级矛盾进一步说明 Wikipedia 百分比不能当作第一手统计。

## 数据来源

- 市场、人口、消费、互联网：[世界银行 WDI](https://data.worldbank.org/)（`metric-long.csv` / `market-latest.csv`）。
- 中国贸易：[中国海关](http://stats.customs.gov.cn/)（`china-trade-yearly.csv` / `china-trade-cagr.csv`）。
- 分品类进口：[UN Comtrade](https://comtradeplus.un.org/)（`products-idn-mys.csv`）。
- 穆斯林人口：各国官方统计（`muslim-official.csv`，仅 6 国）。
- Wikipedia：[中文 OIC 条目](https://zh.wikipedia.org/wiki/%E4%BC%8A%E6%96%AF%E5%85%B0%E5%90%88%E4%BD%9C%E7%BB%84%E7%BB%87)截图及 Pew Forum 2010 年估计表（2013 存档）引用（`data/reference/oic-wikipedia.csv`，仅参照）。

