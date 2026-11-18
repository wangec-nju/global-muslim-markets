import type { MarketProfile, MarketScores } from '../../data/types';
import type { CardContentHandle, CardContentRenderer, CardRenderContext } from '../types';
import { el } from '../dom';
import { chip, countryHero, emptyState } from './parts';

const SCORE_LABELS: Array<[keyof MarketScores, string]> = [
  ['marketSize', '市场规模'],
  ['accessibility', '市场准入'],
  ['growthMomentum', '增长动能'],
];

const MAX_SCORE = 5;

/**
 * Content renderer #2: a market profile. Same shell, completely different
 * content structure — this is the extension point for real research data.
 */
export function createMarketRenderer(): CardContentRenderer {
  return {
    id: 'market',
    label: '市场档案',
    create(ctx): CardContentHandle {
      const root = el('div', { className: 'card-content card-content--market' });

      const render = (next: CardRenderContext): void => {
        const country = next.country;
        const profile = country.market;
        const demoBadge = profile && country.marketMeta.demo
          ? chip('示例数据', 'warn')
          : null;

        const nodes: Node[] = [
          countryHero(country, 'MARKET SNAPSHOT · 市场档案', demoBadge ?? undefined),
        ];

        if (!profile) {
          nodes.push(
            emptyState(
              '暂无市场档案',
              '该国家尚未收录市场资料。在 public/data/market-profiles.json 中补充对应 ISO 数字代码即可。',
            ),
          );
          root.replaceChildren(...nodes);
          return;
        }

        if (profile.headline) {
          nodes.push(el('p', { className: 'market-headline', text: profile.headline }));
        }
        if (profile.summary) {
          nodes.push(el('p', { className: 'market-summary', text: profile.summary }));
        }

        if (profile.tags?.length) {
          const tags = el('div', { className: 'chip-row' });
          for (const tag of profile.tags.slice(0, 5)) tags.append(chip(tag));
          nodes.push(tags);
        }

        if (profile.sectors?.length) {
          nodes.push(el('p', { className: 'card-section-label', text: '重点板块' }));
          const sectors = el('div', { className: 'chip-row' });
          for (const sector of profile.sectors.slice(0, 6)) {
            sectors.append(chip(sector, 'sector'));
          }
          nodes.push(sectors);
        }

        const scoreRows = buildScores(profile);
        if (scoreRows) nodes.push(scoreRows);

        if (country.marketMeta.demo) {
          const notice = el('p', {
            className: 'market-notice',
            text:
              country.marketMeta.notice ??
              '示例数据仅用于展示卡片结构，请替换为经核实的来源。',
          });
          if (country.marketMeta.notice) notice.title = country.marketMeta.notice;
          nodes.push(notice);
        }

        root.replaceChildren(...nodes);
      };

      render(ctx);
      return { element: root, update: render };
    },
  };
}

function buildScores(profile: MarketProfile): HTMLElement | null {
  const scores = profile.scores;
  if (!scores) return null;

  const rows = SCORE_LABELS.flatMap(([key, label]) => {
    const raw = scores[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return [];
    const value = Math.min(Math.max(raw, 0), MAX_SCORE);

    const fill = el('span', { className: 'score__fill' });
    fill.style.width = `${(value / MAX_SCORE) * 100}%`;

    return [
      el(
        'div',
        {
          className: 'score',
          attrs: {
            role: 'meter',
            'aria-label': label,
            'aria-valuemin': '0',
            'aria-valuemax': String(MAX_SCORE),
            'aria-valuenow': String(value),
          },
        },
        el(
          'div',
          { className: 'score__head' },
          el('span', { text: label }),
          el('span', { className: 'score__value', text: value.toFixed(1) }),
        ),
        el('div', { className: 'score__track' }, fill),
      ),
    ];
  });

  if (rows.length === 0) return null;
  return el('div', { className: 'score-list' }, ...rows);
}
