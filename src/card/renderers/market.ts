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
        }

        root.replaceChildren(...nodes);
      };

      render(ctx);
      return { element: root, update: render };
    },
  };
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
