import type { CountryProfile, MarketCountry } from '../data/types';
import { el } from '../card/dom';

interface SearchEntry {
  type: string;
  label: string;
  subtitle: string;
  haystack: string;
  market: MarketCountry;
  profile: CountryProfile;
}

export interface SearchOptions {
  onSelect: (market: MarketCountry) => void;
}

/** Full-dossier search: country, division, city, hub, language, HS2. */
export class SearchController {
  private readonly root: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly results: HTMLElement;
  private readonly count: HTMLElement;
  private entries: SearchEntry[] = [];
  private activeIndex = 0;
  private visible: SearchEntry[] = [];

  constructor(host: HTMLElement, private readonly options: SearchOptions) {
    this.root = el('div', { className: 'search-layer', attrs: { hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': '搜索全部国家数据' } });
    this.root.addEventListener('pointerdown', (event) => {
      if (event.target === this.root) this.close();
    });

    const close = el('button', { className: 'search__close', text: '×', attrs: { type: 'button', 'aria-label': '关闭搜索' } });
    close.addEventListener('click', () => this.close());

    this.input = el('input', {
      className: 'search__input',
      attrs: {
        type: 'search',
        placeholder: '搜索国家、城市、语言、行政区、机场/港口、HS 编码…',
        'aria-label': '搜索全部国家数据',
        autocomplete: 'off',
        spellcheck: 'false',
      },
    });
    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('keydown', (event) => this.onKeyDown(event));

    this.count = el('span', { className: 'search__count', text: '全部数据' });
    this.results = el('div', { className: 'search__results' });

    this.root.append(
      el('div', { className: 'search' },
        el('div', { className: 'search__bar' },
          el('span', { className: 'search__eyebrow', text: 'SEARCH / 全量检索' }),
          close,
        ),
        el('div', { className: 'search__field' }, this.input, this.count),
        this.results,
        el('p', { className: 'search__hint', text: 'Esc 关闭 · ↑↓ 选择 · Enter 打开完整档案' }),
      ),
    );
    host.append(this.root);
    window.addEventListener('keydown', this.onGlobalKeyDown);
  }

  setData(markets: MarketCountry[]): void {
    this.entries = [];
    for (const market of markets) {
      const profile = market.profile;
      if (!profile || profile.isChina) continue;
      const base = [market.nameZh, market.nameEn, market.iso3, profile.officialName, profile.regionZh, profile.subregion]
        .filter(Boolean)
        .join(' ');
      this.entries.push({
        type: '国家',
        label: `${market.flag ?? ''} ${market.nameZh}`.trim(),
        subtitle: [market.nameEn, profile.regionZh, profile.subregion].filter(Boolean).join(' · '),
        haystack: normalize(base),
        market,
        profile,
      });

      for (const language of profile.officialLanguages) {
        this.entries.push({
          type: '语言',
          label: language.name,
          subtitle: `${market.nameZh} · 官方语言`,
          haystack: normalize(`${language.code} ${language.name} ${market.nameZh}`),
          market,
          profile,
        });
      }
      if (profile.commonLanguages) {
        this.entries.push({
          type: '常用语言',
          label: profile.commonLanguages,
          subtitle: `${market.nameZh} · CIA World Factbook`,
          haystack: normalize(`${profile.commonLanguages} ${market.nameZh}`),
          market,
          profile,
        });
      }
      for (const division of profile.divisions) {
        this.entries.push({
          type: '行政区',
          label: division.nameZh ?? division.name,
          subtitle: `${market.nameZh} · ${division.name}`,
          haystack: normalize(`${division.name} ${division.nameZh ?? ''} ${market.nameZh}`),
          market,
          profile,
        });
      }
      for (const city of profile.cities) {
        this.entries.push({
          type: '城市',
          label: city.nameZh ?? city.nameEn,
          subtitle: `${market.nameZh} · ${city.nameEn}${city.nameLocal && city.nameLocal !== city.nameEn ? ` / ${city.nameLocal}` : ''}`,
          haystack: normalize(`${city.nameEn} ${city.nameLocal} ${city.nameZh ?? ''} ${market.nameZh}`),
          market,
          profile,
        });
      }
      for (const hub of profile.hubs) {
        this.entries.push({
          type: hub.type === 'airport' ? '机场' : '港口',
          label: hub.nameZh ?? hub.name,
          subtitle: `${market.nameZh} · ${[hub.code, hub.city].filter(Boolean).join(' · ')}`,
          haystack: normalize(`${hub.name} ${hub.nameZh ?? ''} ${hub.code ?? ''} ${hub.city ?? ''} ${market.nameZh}`),
          market,
          profile,
        });
      }
      for (const product of profile.hs2) {
        this.entries.push({
          type: 'HS2',
          label: `HS ${product.code} · ${truncate(product.name, 48)}`,
          subtitle: `${market.nameZh} · 2023 进口占比 ${product.sharePct?.toFixed(1) ?? '—'}%`,
          haystack: normalize(`${product.code} ${product.name} ${market.nameZh}`),
          market,
          profile,
        });
      }
    }
  }

  open(): void {
    this.root.hidden = false;
    document.body.classList.add('is-search-open');
    this.input.value = '';
    this.update();
    requestAnimationFrame(() => this.input.focus());
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    document.body.classList.remove('is-search-open');
    this.input.blur();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onGlobalKeyDown);
    this.root.remove();
  }

  private update(): void {
    const query = normalize(this.input.value.trim());
    if (!query) {
      this.visible = this.entries
        .filter((entry) => entry.type === '国家')
        .slice(0, 16);
      this.count.textContent = `${this.entries.length} 条索引`;
    } else {
      const scored = this.entries
        .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
        .filter((item): item is { entry: SearchEntry; score: number } => item.score != null)
        .sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label, 'zh-CN'))
        .slice(0, 50);
      this.visible = scored.map((item) => item.entry);
      this.count.textContent = `${scored.length} 个结果`;
    }
    this.activeIndex = 0;
    this.renderResults();
  }

  private renderResults(): void {
    this.results.replaceChildren();
    if (!this.visible.length) {
      this.results.append(el('p', { className: 'search__empty', text: '没有匹配项；试试国家名、城市名、语言、机场代码或 HS 编码。' }));
      return;
    }
    this.visible.forEach((entry, index) => {
      const button = el('button', {
        className: `search-result${index === this.activeIndex ? ' is-active' : ''}`,
        attrs: { type: 'button' },
      });
      button.append(
        el('span', { className: 'search-result__type', text: entry.type }),
        el('span', { className: 'search-result__label', text: entry.label }),
        el('span', { className: 'search-result__sub', text: entry.subtitle }),
      );
      button.addEventListener('pointerenter', () => {
        this.activeIndex = index;
        this.renderResults();
      });
      button.addEventListener('click', () => this.choose(entry));
      this.results.append(button);
    });
  }

  private choose(entry: SearchEntry): void {
    this.close();
    this.options.onSelect(entry.market);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
      return;
    }
    if (!this.visible.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.visible.length;
      this.renderResults();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + this.visible.length) % this.visible.length;
      this.renderResults();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = this.visible[this.activeIndex];
      if (entry) this.choose(entry);
    }
  }

  private readonly onGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen) this.close();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.open();
    }
  };
}

function scoreEntry(entry: SearchEntry, query: string): number | null {
  const label = normalize(entry.label);
  if (label.startsWith(query)) return 0;
  if (label.includes(query)) return 1;
  if (normalize(entry.subtitle).includes(query)) return 2;
  if (entry.haystack.includes(query)) return 3;
  return null;
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
