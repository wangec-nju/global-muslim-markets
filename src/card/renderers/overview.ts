import { formatArea, regionLabel, subregionLabel } from '../../data/labels';
import type { CardContentHandle, CardContentRenderer, CardRenderContext } from '../types';
import { el } from '../dom';
import { countryHero, emptyState, metaItem, sourceNote } from './parts';

/**
 * Content renderer #1: a neutral country profile built only from
 * world-atlas + world-countries facts. No market claims live here.
 */
export function createOverviewRenderer(): CardContentRenderer {
  return {
    id: 'overview',
    label: '国家概览',
    create(ctx): CardContentHandle {
      const root = el('div', { className: 'card-content card-content--overview' });

      const render = (next: CardRenderContext): void => {
        const country = next.country;
        const nodes: Node[] = [countryHero(country, 'COUNTRY PROFILE · 国家概览')];

        if (!country.hasFacts) {
          nodes.push(
            emptyState(
              '暂无基础资料',
              '该地区未匹配到 ISO 国家资料，仍可通过 world-atlas 查看边界与位置。',
            ),
          );
          nodes.push(sourceNote('地理边界：world-atlas 110m'));
          root.replaceChildren(...nodes);
          return;
        }

        const area = formatArea(country.area);
        const region =
          subregionLabel(country.subregion) ??
          regionLabel(country.region) ??
          country.subregion ??
          country.region;

        const grid = el('dl', { className: 'card-meta' });
        grid.append(metaItem('首都', country.capital));
        grid.append(metaItem('面积', area));
        grid.append(metaItem('区域', region));
        grid.append(metaItem('ISO', [country.iso2, country.iso3].filter(Boolean).join(' / ')));

        nodes.push(grid);
        nodes.push(sourceNote('资料：world-atlas 110m · world-countries'));

        root.replaceChildren(...nodes);
      };

      render(ctx);
      return { element: root, update: render };
    },
  };
}
