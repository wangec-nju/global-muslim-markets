import type { CountryProfile, MarketCountry } from '../data/types';
import { formatUsd } from '../data/format';
import { computeCardPosition } from '../card/position';
import { el } from '../card/dom';
import type { ScreenPoint } from '../shared/coords';

/**
 * China is special: red highlight, hover only, no click/sidebar/search.
 * It shows provinces, hubs and trade-flow partners, not a market dossier.
 */
export class ChinaHover {
  private readonly root: HTMLElement;
  private readonly surface: HTMLElement;
  private open = false;

  constructor(host: HTMLElement) {
    this.root = el('aside', {
      className: 'china-hover',
      attrs: { hidden: true, 'aria-label': '中国省级行政区、枢纽与对穆斯林市场贸易' },
    });
    this.surface = el('div', { className: 'china-hover__surface' });
    this.root.append(this.surface);
    host.append(this.root);
  }

  show(profile: CountryProfile, markets: MarketCountry[], point: ScreenPoint): void {
    this.open = true;
    this.render(profile, markets);
    this.root.hidden = false;
    this.place(point);
  }

  move(point: ScreenPoint): void {
    if (!this.open) return;
    this.place(point);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return this.open;
  }

  private place(point: ScreenPoint): void {
    const rect = this.surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const placement = computeCardPosition(
      point,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    this.root.style.transform = `translate3d(${placement.x}px, ${placement.y}px, 0)`;
  }

  private render(profile: CountryProfile, markets: MarketCountry[]): void {
    const partners = markets
      .map((market) => ({
        market,
        total:
          (market.chinaTrade?.exports?.value ?? 0) +
          (market.chinaTrade?.imports?.value ?? 0),
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const provinces = el('div', { className: 'china-provinces' });
    for (const division of profile.divisions) {
      provinces.append(el('span', { text: division.nameZh ?? division.name }));
    }

    const hubs = el('div', { className: 'china-hubs' });
    for (const hub of profile.hubs.slice(0, 8)) {
      hubs.append(
        el('span', { className: 'china-hub' },
          el('b', { text: hub.type === 'airport' ? '空' : '港' }),
          el('span', { text: hub.nameZh ?? hub.name }),
          hub.code ? el('em', { text: hub.code }) : null,
        ),
      );
    }

    const partnersEl = el('div', { className: 'china-partners' });
    for (const { market, total } of partners) {
      partnersEl.append(
        el('div', { className: 'china-partner' },
          el('span', { text: `${market.flag ?? ''} ${market.nameZh}`.trim() }),
          el('strong', { text: formatUsd(total) }),
        ),
      );
    }

    this.surface.replaceChildren(
      el('div', { className: 'china-hover__head' },
        el('span', { className: 'china-hover__flag' },
          profile.flagUrl
            ? el('img', { attrs: { src: profile.flagUrl, alt: '' } })
            : (profile.flag ?? '🇨🇳'),
        ),
        el('div', {},
          el('p', { className: 'china-hover__eyebrow', text: 'CHINA · 仅悬停' }),
          el('h2', { text: '中国' }),
          el('span', { text: `${profile.divisions.length} 个省级行政区 · ${profile.coverage.airports} 个机场样本 · ${profile.coverage.ports} 个港口样本` }),
        ),
      ),
      el('section', { className: 'china-section' },
        el('h3', { text: '省级行政区（含台湾省）' }),
        provinces,
      ),
      el('section', { className: 'china-section' },
        el('h3', { text: '国际枢纽' }),
        hubs,
      ),
      el('section', { className: 'china-section' },
        el('h3', { text: '与穆斯林市场的贸易联系' }),
        partnersEl,
        el('p', { className: 'china-note', text: '按 2025 年中国进出口额排序；地球上的弧线为贸易流示意，不是实际航道。' }),
      ),
    );
  }
}
