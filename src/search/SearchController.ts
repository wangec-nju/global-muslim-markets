import type { CountryProfile, MarketCountry } from '../data/types';
import { formatPercent, formatPopulation, formatUsd, formatUsdPerCapita } from '../data/format';
import { el } from '../card/dom';
import { normalizeSearch, scoreSearch } from './fuzzy';

interface SearchEntry {
  type: string;
  label: string;
  subtitle: string;
  haystack: string;
  /** Data-completeness rank for the recommendation list. */
  rankScore?: number;
  market: MarketCountry;
  profile?: CountryProfile;
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
  private resultButtons: HTMLButtonElement[] = [];

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
      if (profile?.isChina || market.iso3 === 'CHN') continue;

      const add = (
        type: string,
        label: string,
        subtitle: string,
        haystack: string,
      ): void => {
        this.entries.push({
          type,
          label,
          subtitle,
          haystack: `${type} ${haystack}`,
          rankScore: type === '国家' ? countryRankScore(market) : undefined,
          market,
          profile,
        });
      };

      add(
        '国家',
        `${market.flag ?? ''} ${market.nameZh}`.trim(),
        [market.nameEn, profile?.regionZh, profile?.subregion].filter(Boolean).join(' · '),
        [
          market.nameZh,
          market.nameEn,
          market.iso3,
          market.unM49,
          market.id,
          profile?.officialName,
          profile?.region,
          profile?.regionZh,
          profile?.subregion,
          profile?.capital.nameZh,
          profile?.capital.nameEn,
          profile?.currency?.code,
          profile?.currency?.name,
          profile?.callingCode,
        ].filter(Boolean).join(' '),
      );

      if (!profile) continue;

      add(
        '首都',
        profile.capital.nameZh ?? profile.capital.nameEn ?? '—',
        `${market.nameZh} · 首都`,
        `${profile.capital.nameEn ?? ''} ${profile.capital.nameZh ?? ''} ${market.nameZh} capital 首都`,
      );
      if (profile.currency) {
        add(
          '货币',
          `${profile.currency.name}（${profile.currency.code}）`,
          `${market.nameZh} · 货币`,
          `${profile.currency.name} ${profile.currency.code} ${profile.currency.symbol ?? ''} ${market.nameZh} currency 货币`,
        );
      }

      for (const language of profile.officialLanguages) {
        add(
          '语言',
          language.name,
          `${market.nameZh} · 官方语言`,
          `${language.code} ${language.name} ${market.nameZh} language 语言 官方语言`,
        );
      }
      if (profile.commonLanguages) {
        add(
          '常用语言',
          profile.commonLanguages,
          `${market.nameZh} · CIA World Factbook`,
          `${profile.commonLanguages} ${market.nameZh} common language 常用语言`,
        );
      }

      for (const division of profile.divisions) {
        add(
          '行政区',
          division.nameZh ?? division.name,
          `${market.nameZh} · ${division.name}`,
          `${division.name} ${division.nameZh ?? ''} ${division.code} ${market.nameZh} admin 行政区`,
        );
      }
      for (const city of profile.cities) {
        add(
          '城市',
          city.nameZh ?? city.nameEn,
          `${market.nameZh} · ${city.nameEn}${city.nameLocal && city.nameLocal !== city.nameEn ? ` / ${city.nameLocal}` : ''}`,
          `${city.nameEn} ${city.nameLocal} ${city.nameZh ?? ''} ${city.admin1 ?? ''} ${market.nameZh} city 城市`,
        );
      }
      for (const hub of profile.hubs) {
        const type = hub.type === 'airport' ? '机场' : hub.type === 'port' ? '港口' : '物流';
        add(
          type,
          hub.nameZh ?? hub.name,
          `${market.nameZh} · ${[hub.code, hub.city].filter(Boolean).join(' · ')}`,
          `${hub.name} ${hub.nameZh ?? ''} ${hub.code ?? ''} ${hub.city ?? ''} ${hub.subtype ?? ''} ${market.nameZh} ${type}`,
        );
      }
      for (const product of profile.hs2) {
        add(
          'HS2',
          `HS ${product.code} · ${truncate(product.name, 48)}`,
          `${market.nameZh} · ${product.year ?? '—'} 进口占比 ${product.sharePct?.toFixed(1) ?? '—'}%`,
          `${product.code} ${product.name} ${market.nameZh} HS HS2 进口 品类`,
        );
      }

      const metric = (
        label: string,
        key: string,
        value: number | null,
        formatted: string,
        year: string | null,
      ): void => {
        if (value == null) return;
        add(
          '指标',
          `${label} ${formatted}`,
          `${market.nameZh} · ${year ?? '—'}`,
          `${label} ${key} ${value} ${formatted} ${market.nameZh} metric 指标`,
        );
      };
      const metrics = market.metrics;
      metric('人口', 'population', metrics.population?.value ?? null, formatPopulation(metrics.population?.value ?? null), metrics.population?.year ?? null);
      metric('GDP', 'gdp', metrics.gdp?.value ?? null, formatUsd(metrics.gdp?.value ?? null), metrics.gdp?.year ?? null);
      metric('人均 GDP', 'gdp per capita', metrics.gdpPerCapita?.value ?? null, formatUsdPerCapita(metrics.gdpPerCapita?.value ?? null), metrics.gdpPerCapita?.year ?? null);
      metric('家庭消费', 'household consumption', metrics.householdConsumption?.value ?? null, formatUsd(metrics.householdConsumption?.value ?? null), metrics.householdConsumption?.year ?? null);
      metric('互联网普及率', 'internet penetration', metrics.internetPenetration?.value ?? null, formatPercent(metrics.internetPenetration?.value ?? null), metrics.internetPenetration?.year ?? null);
      metric('城镇化率', 'urban share', metrics.urbanShare?.value ?? null, formatPercent(metrics.urbanShare?.value ?? null), metrics.urbanShare?.year ?? null);
      metric('青年人口占比', 'youth share', metrics.youthShare?.value ?? null, formatPercent(metrics.youthShare?.value ?? null), metrics.youthShare?.year ?? null);
      metric('劳动年龄人口占比', 'working age share', metrics.workingAgeShare?.value ?? null, formatPercent(metrics.workingAgeShare?.value ?? null), metrics.workingAgeShare?.year ?? null);

      const officialShare = market.muslim.status === 'official' ? market.muslim.share : null;
      const referenceShare = market.muslimReference;
      const shareText = officialShare != null
        ? formatPercent(officialShare, 2)
        : referenceShare?.display ?? null;
      if (shareText) {
        add(
          '穆斯林',
          `穆斯林占比 ${shareText}`,
          `${market.nameZh} · ${officialShare != null ? '官方普查' : `Pew ${referenceShare?.year ?? 2010} 参考`}`,
          `穆斯林 muslim 占比 share ${shareText} ${market.muslim.year ?? referenceShare?.year ?? ''} ${market.nameZh} 人口`,
        );
      }

      if (market.chinaTrade) {
        for (const [direction, flow] of [['出口', market.chinaTrade.exports], ['进口', market.chinaTrade.imports]] as const) {
          if (!flow) continue;
          add(
            '中国贸易',
            `中国${direction} ${formatUsd(flow.value)}`,
            `${market.nameZh} · ${flow.year}`,
            `中国${direction} 贸易 ${flow.value ?? ''} ${formatUsd(flow.value)} ${market.nameZh} trade`,
          );
        }
      }

      for (const product of market.products) {
        add(
          '产品',
          product.name,
          `${market.nameZh} · HS ${product.code}`,
          `${product.code} ${product.name} ${product.category ?? ''} ${market.nameZh} product 产品`,
        );
      }
    }
    if (this.isOpen) this.update();
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
    const query = normalizeSearch(this.input.value.trim());
    if (!query) {
      this.visible = this.entries
        .filter((entry) => entry.type === '国家')
        .sort((a, b) =>
          (b.rankScore ?? 0) - (a.rankScore ?? 0) ||
          Number(b.market.focus) - Number(a.market.focus) ||
          a.label.localeCompare(b.label, 'zh-CN'),
        )
        .slice(0, 12);
      this.count.textContent = `推荐 ${this.visible.length} 国 · 关键指标完整度`;
    } else {
      const matches = this.entries
        .map((entry) => ({ entry, score: scoreSearch(entry, query) }))
        .filter((item): item is { entry: SearchEntry; score: number } => item.score != null)
        .sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label, 'zh-CN'));
      this.visible = matches.slice(0, 100).map((item) => item.entry);
      this.count.textContent = `${matches.length} 个结果`;
    }
    this.activeIndex = 0;
    this.renderResults();
  }

  private renderResults(): void {
    this.results.replaceChildren();
    this.resultButtons = [];
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
      // Do not re-render the list on pointerenter: replacing the button under
      // the pointer swallows the subsequent click.
      button.addEventListener('pointerenter', () => this.setActive(index));
      button.addEventListener('click', () => this.choose(entry));
      this.resultButtons.push(button);
      this.results.append(button);
    });
  }

  private setActive(index: number): void {
    this.activeIndex = index;
    this.resultButtons.forEach((button, buttonIndex) => {
      button.classList.toggle('is-active', buttonIndex === index);
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
      this.setActive((this.activeIndex + 1) % this.visible.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.setActive((this.activeIndex - 1 + this.visible.length) % this.visible.length);
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

function countryRankScore(market: MarketCountry): number {
  const metrics = market.metrics;
  let score = 0;
  for (const metric of [
    metrics.population,
    metrics.populationGrowth,
    metrics.urbanShare,
    metrics.youthShare,
    metrics.workingAgeShare,
    metrics.seniorShare,
    metrics.gdp,
    metrics.gdpPerCapita,
    metrics.gniPerCapita,
    metrics.householdConsumption,
    metrics.householdConsumptionPerCapita,
    metrics.internetPenetration,
    metrics.goodsExports,
    metrics.goodsImports,
  ]) {
    if (metric?.value != null) score += 1;
  }
  if (market.muslim.status === 'official') score += 2;
  else if (market.muslimReference) score += 1;
  if (market.chinaTrade?.exports) score += 1;
  if (market.chinaTrade?.imports) score += 1;
  const coverage = market.profile?.coverage;
  if (coverage) {
    score += Math.min(coverage.divisions, 3);
    score += Math.min(coverage.cities, 3);
    score += Math.min(coverage.airports, 2);
    score += Math.min(coverage.ports, 2);
    score += Math.min(coverage.logistics, 2);
    score += Math.min(coverage.hs2, 3);
  }
  return score;
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
