import type { MarketCountry, TradeFlow } from '../../data/types';
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
        nodes.push(muslimShareLine(market));
        nodes.push(profileBasics(market));
        nodes.push(geographySection(market, compact));
        nodes.push(tradeSection(market, compact));

        if (!compact) {
          if (market.products.length > 0) nodes.push(productsSection(market));
          nodes.push(
            sourceNote(
              '数据：世界银行 WDI · 中国海关 · UN Comtrade；穆斯林占比优先使用官方普查，其余为 Pew 2010 参考值。',
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
  section.append(sectionLabel('地理与通道', 'GeoNames · 点击查看枢纽与航线'));

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
  section.append(
    marketNote('点击查看机场/港口/物流枢纽、8 个中国起运港与 HS2 品类。', 'market-hint'),
  );
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

function muslimShareLine(market: MarketCountry): HTMLElement {
  const official = market.muslim;
  const reference = market.muslimReference;
  const isOfficial = official.status === 'official' && official.share != null;
  const value = isOfficial
    ? formatPercent(official.share, 2)
    : reference?.display ?? '—';
  const note = isOfficial
    ? `${official.year ?? ''} 官方普查`.trim()
    : reference
      ? `Pew ${reference.year ?? 2010} 参考`
      : '暂无占比';
  const row = el('div', {
    className: `card-muslim${isOfficial ? ' is-official' : ' is-reference'}`,
  });
  row.append(
    el('span', { className: 'card-muslim__label', text: '穆斯林占总人口' }),
    el('strong', { className: 'card-muslim__value', text: value }),
    el('span', { className: 'card-muslim__note', text: note }),
  );
  return row;
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
