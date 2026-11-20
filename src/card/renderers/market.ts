import type { MarketCountry, ProfileHub, TradeFlow } from '../../data/types';
import {
  formatPercent,
  formatPopulation,
  formatSignedPercent,
  formatTradeShare,
  formatUsd,
  formatUsdPerCapita,
} from '../../data/format';
import type { CardContentHandle, CardContentRenderer, CardRenderContext } from '../types';
import { el } from '../dom';
import { chip, marketHero, marketNote, metricCell, sectionLabel, sourceNote } from './parts';

/**
 * Market content renderer. The shell owns behavior and position; this file
 * owns only what a market card says. Preview mode stays compact, pinned mode
 * exposes the full trade/product detail.
 */
export function createMarketRenderer(): CardContentRenderer {
  return {
    id: 'market',
    label: '市场档案',
    create(ctx): CardContentHandle {
      const root = el('div', { className: 'card-content card-content--market' });

      const render = (next: CardRenderContext): void => {
        const market = next.country;
        const compact = next.mode === 'preview';
        const nodes: Node[] = [
          marketHero(
            market,
            'OIC MARKET · 市场档案',
            market.focus ? chip('重点样本', 'warn') : undefined,
          ),
        ];

        nodes.push(metricGrid(market, compact));
        nodes.push(profileBasics(market));
        nodes.push(geographySection(market, compact));
        nodes.push(tradeSection(market, compact));
        if (market.muslim.status === 'official') {
          nodes.push(muslimSection(market));
        }

        if (!compact) {
          if (market.products.length > 0) nodes.push(productsSection(market));
          nodes.push(
            sourceNote(
              '数据：世界银行 WDI · 中国海关 · UN Comtrade · 各国官方统计；穆斯林人口仅在有官方普查时展示，缺失值不补零。',
            ),
          );
        } else {
          nodes.push(marketNote('点击查看行政区划、城市、枢纽与 HS 品类全量档案。', 'market-hint'));
        }

        root.replaceChildren(...nodes);
      };

      render(ctx);
      return { element: root, update: render };
    },
  };
}

function profileBasics(market: MarketCountry): HTMLElement {
  const profile = market.profile;
  const section = el('section', { className: 'market-section profile-basics' });
  section.append(sectionLabel('国家概况', 'world-countries · CIA World Factbook'));

  if (!profile) {
    section.append(marketNote('国家档案尚未载入。', 'market-hint'));
    return section;
  }

  const rows: Array<[string, string]> = [];
  rows.push(['官方语言', formatLanguages(profile.officialLanguages)]);
  if (profile.commonLanguages) {
    rows.push(['常用语言', truncate(profile.commonLanguages, 150)]);
  }
  rows.push([
    '首都',
    profile.capital.nameZh ?? profile.capital.nameEn ?? '—',
  ]);
  rows.push(['地区', [profile.regionZh, profile.subregion].filter(Boolean).join(' · ') || '—']);

  const grid = el('dl', { className: 'profile-facts' });
  for (const [label, value] of rows) {
    grid.append(
      el('div', { className: 'profile-fact' },
        el('dt', { text: label }),
        el('dd', { text: value, attrs: { title: value } }),
      ),
    );
  }
  section.append(grid);
  return section;
}

function geographySection(market: MarketCountry, compact: boolean): HTMLElement {
  const profile = market.profile;
  const section = el('section', { className: 'market-section' });
  section.append(sectionLabel('地理与通道', 'GeoNames · OurAirports · NGA World Port Index'));

  if (!profile) {
    section.append(marketNote('地理档案尚未载入。', 'market-hint'));
    return section;
  }

  const divisions = profile.divisions.slice(0, compact ? 5 : 8);
  const divisionRow = el('div', { className: 'profile-line' });
  divisionRow.append(
    el('span', { className: 'profile-line__label', text: `一级行政区 ${profile.coverage.divisions}` }),
    el('span', {
      className: 'profile-line__value',
      text: divisions.length
        ? divisions.map((division) => division.nameZh ?? division.name).join(' · ')
        : '暂未收录',
    }),
  );
  section.append(divisionRow);

  const hubs = selectHubs(profile.hubs, compact ? 3 : 6);
  const hubRow = el('div', { className: 'profile-line' });
  hubRow.append(
    el('span', { className: 'profile-line__label', text: '机场 / 港口' }),
    el('span', {
      className: 'profile-line__value',
      text: hubs.length
        ? hubs.map(formatHub).join(' · ')
        : '暂未收录',
    }),
  );
  section.append(hubRow);

  const trade = market.chinaTrade;
  if (trade) {
    section.append(
      marketNote(
        `对华贸易 ${trade.year}：出口 ${formatUsd(trade.exports?.value ?? null)} · 进口 ${formatUsd(trade.imports?.value ?? null)}。`,
        'market-hint',
      ),
    );
  }
  if (market.seaRoute) {
    const primary = market.seaRoute.options[0];
    section.append(
      marketNote(
        `海运：${primary?.originName ?? '中国'} → ${market.seaRoute.destPort}${market.seaRoute.via ? `（${market.seaRoute.via}）` : ''} · 约 ${formatKm(primary?.distanceKm ?? null)}；另有 ${Math.max(0, market.seaRoute.options.length - 1)} 个中国起运港可选。`,
        'market-hint',
      ),
    );
  }

  return section;
}

function formatLanguages(languages: Array<{ code: string; name: string }>): string {
  if (!languages.length) return '—';
  const display = (() => {
    try {
      return new Intl.DisplayNames(['zh-CN'], { type: 'language' });
    } catch {
      return null;
    }
  })();
  return languages
    .map((language) => display?.of(language.code) ?? language.name)
    .join(' / ');
}

function selectHubs(hubs: ProfileHub[], limit: number): ProfileHub[] {
  const groups: Array<ProfileHub['type']> = ['airport', 'port', 'logistics'];
  const picked: ProfileHub[] = [];
  for (const type of groups) {
    const first = hubs.find((hub) => hub.type === type);
    if (first) picked.push(first);
  }
  for (const hub of hubs) {
    if (picked.length >= limit) break;
    if (!picked.includes(hub)) picked.push(hub);
  }
  return picked.slice(0, limit);
}

function formatHub(hub: ProfileHub): string {
  const label = hub.nameZh ?? hub.name;
  const tag = hub.type === 'airport' ? '空' : hub.type === 'port' ? '港' : '物';
  return `${tag} ${hub.code ? `${label}（${hub.code}）` : label}`;
}

function formatKm(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)} km`;
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function metricGrid(market: MarketCountry, compact: boolean): HTMLElement {
  const grid = el('div', { className: 'market-metrics' });
  grid.append(
    metricCell('总人口', market.metrics.population, formatPopulation),
    metricCell('GDP', market.metrics.gdp, formatUsd),
    metricCell('家庭消费', market.metrics.householdConsumption, formatUsd),
    metricCell('互联网普及率', market.metrics.internetPenetration, formatPercent),
  );

  if (!compact) {
    grid.append(
      metricCell('城镇化率', market.metrics.urbanShare, formatPercent),
      metricCell('人均 GDP', market.metrics.gdpPerCapita, formatUsdPerCapita),
    );
  }

  const section = el('section', { className: 'market-section' });
  section.append(sectionLabel('市场基本面', 'data/source/market-latest.csv（世界银行 WDI）'), grid);
  return section;
}

function tradeSection(market: MarketCountry, compact: boolean): HTMLElement {
  const trade = market.chinaTrade;
  const section = el('section', { className: 'market-section' });
  section.append(sectionLabel(`中国贸易 · ${trade?.year ?? '暂无年份'}`, 'data/source/china-trade-yearly.csv + china-trade-cagr.csv（中国海关）'));

  const list = el('div', { className: 'trade-list' });
  list.append(
    tradeFlow('中国出口', '中国对该市场出口', trade?.exports ?? null, compact),
    tradeFlow('中国进口', '中国从该市场进口', trade?.imports ?? null, compact),
  );
  section.append(list);
  return section;
}

function tradeFlow(
  label: string,
  hint: string,
  flow: TradeFlow | null,
  compact: boolean,
): HTMLElement {
  const row = el('div', { className: 'trade-flow' });
  row.append(
    el(
      'div',
      { className: 'trade-flow__head' },
      el('span', { className: 'trade-flow__label', text: label, attrs: { title: hint } }),
      el('strong', { className: 'trade-flow__value', text: formatUsd(flow?.value ?? null) }),
    ),
  );

  if (flow) {
    const meta = el('div', { className: 'trade-flow__meta' });
    meta.append(
      el('span', {
        className: `trade-flow__change${flow.yoy != null && flow.yoy < 0 ? ' is-negative' : ''}`,
        text: `同比 ${formatSignedPercent(flow.yoy)}`,
      }),
    );
    if (!compact) {
      meta.append(
        el('span', {
          className: 'trade-flow__change',
          text: `5年 CAGR ${formatSignedPercent(flow.cagr2020_2025)}`,
        }),
        el('span', {
          className: 'trade-flow__share',
          text: `占中国${label === '中国出口' ? '出口' : '进口'} ${formatTradeShare(flow.shareOfChinaTotal)}`,
        }),
      );
    }
    row.append(meta);
  }

  return row;
}

function muslimSection(market: MarketCountry): HTMLElement {
  const section = el('section', { className: 'market-section' });
  section.append(sectionLabel('穆斯林人口', 'data/source/muslim-official.csv（各国官方统计）'));

  const stats = el('div', { className: 'muslim-stats' });
  stats.append(
    el(
      'div',
      { className: 'muslim-stat' },
      el('strong', { text: formatPercent(market.muslim.share) }),
      el('span', { className: 'muslim-stat__label', text: '人口占比' }),
    ),
    el(
      'div',
      { className: 'muslim-stat' },
      el('strong', { text: formatPopulation(market.muslim.population) }),
      el('span', { className: 'muslim-stat__label', text: '穆斯林人口' }),
    ),
  );
  section.append(stats);
  section.append(
    marketNote(
      [
        market.muslim.year ? `${market.muslim.year} 年普查` : null,
        market.muslim.source,
      ]
        .filter(Boolean)
        .join(' · ') || '官方普查快照',
      'market-hint',
    ),
  );

  return section;
}

function productsSection(market: MarketCountry): HTMLElement {
  const section = el('section', { className: 'market-section' });
  section.append(sectionLabel('代表进口品类 · 2025', 'data/source/products-idn-mys.csv（UN Comtrade）'));

  const list = el('div', { className: 'product-list' });
  for (const product of market.products) {
    list.append(
      el(
        'div',
        { className: 'product-item' },
        el(
          'div',
          { className: 'product-item__head' },
          el('span', { className: 'product-item__name', text: product.name }),
          el('span', { className: 'product-item__code', text: `HS ${product.code}` }),
        ),
        el(
          'div',
          { className: 'product-item__meta' },
          el('span', { text: `进口 ${formatUsd(product.worldImports)}` }),
          el('span', {
            text:
              product.chinaShare == null
                ? '中国份额 —'
                : `中国份额 ${formatTradeShare(product.chinaShare)}`,
          }),
        ),
      ),
    );
  }

  section.append(list);
  section.append(marketNote('研究筛选口径，不是清真认证目录。', 'market-hint'));
  return section;
}
