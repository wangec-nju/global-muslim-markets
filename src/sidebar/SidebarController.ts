import type { CountryProfile, MarketCountry, ProfileHub } from '../data/types';
import {
  formatPercent,
  formatPopulation,
  formatSignedPercent,
  formatTradeShare,
  formatUsd,
  formatUsdPerCapita,
} from '../data/format';
import { el } from '../card/dom';

export interface SidebarOptions {
  onClose?: () => void;
}

/**
 * Full country dossier. Clicking a market opens this panel; the hover card
 * stays compact and delegates depth here.
 */
export class SidebarController {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly flag: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private market: MarketCountry | null = null;

  constructor(host: HTMLElement, private readonly options: SidebarOptions = {}) {
    this.root = el('div', { className: 'dossier-layer', attrs: { hidden: true } });
    this.root.addEventListener('pointerdown', (event) => {
      if (event.target === this.root) this.close();
    });

    this.panel = el('aside', {
      className: 'dossier',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '国家完整档案' },
    });

    this.flag = el('div', { className: 'dossier__flag', attrs: { 'aria-hidden': 'true' } });
    this.title = el('h2', { className: 'dossier__title' });
    this.subtitle = el('p', { className: 'dossier__subtitle' });
    this.closeButton = el('button', {
      className: 'dossier__close',
      text: '×',
      attrs: { type: 'button', 'aria-label': '关闭完整档案' },
    });
    this.closeButton.addEventListener('click', () => this.close());

    const header = el(
      'header',
      { className: 'dossier__header' },
      this.flag,
      el('div', { className: 'dossier__heading' }, this.title, this.subtitle),
      this.closeButton,
    );
    this.body = el('div', { className: 'dossier__body' });
    this.panel.append(header, this.body);
    this.root.append(this.panel);
    host.append(this.root);

    window.addEventListener('keydown', this.onKeyDown);
  }

  open(market: MarketCountry): void {
    this.market = market;
    this.render(market);
    this.root.hidden = false;
    document.body.classList.add('is-dossier-open');
    this.panel.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    document.body.classList.remove('is-dossier-open');
    this.market = null;
    this.options.onClose?.();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  get countryId(): string | null {
    return this.market?.id ?? null;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen) this.close();
  };

  private render(market: MarketCountry): void {
    const profile = market.profile;
    this.flag.replaceChildren();
    if (profile?.flagUrl) {
      this.flag.append(el('img', { attrs: { src: profile.flagUrl, alt: '' } }));
    } else {
      this.flag.textContent = market.flag ?? market.nameZh.slice(0, 2);
    }
    this.title.textContent = market.nameZh;
    this.subtitle.textContent = [
      market.nameEn,
      profile?.regionZh,
      profile?.subregion,
      market.focus ? '重点样本' : null,
    ]
      .filter(Boolean)
      .join(' · ');

    if (!profile) {
      this.body.replaceChildren(el('p', { className: 'dossier__empty', text: '档案尚未载入。' }));
      return;
    }

    this.body.replaceChildren(
      overviewSection(profile),
      marketSection(market),
      divisionsSection(profile),
      citiesSection(profile),
      hubsSection(profile),
      hs2Section(profile),
      sourcesSection(profile),
    );
  }
}

function overviewSection(profile: CountryProfile): HTMLElement {
  const section = dossierSection('国家概况', 'world-countries · CIA World Factbook');
  const grid = el('dl', { className: 'dossier-facts' });
  const rows: Array<[string, string]> = [
    ['正式名称', profile.officialName],
    ['官方语言', formatLanguages(profile.officialLanguages)],
    ['常用语言', profile.commonLanguages ?? '暂未收录'],
    ['首都', profile.capital.nameZh ?? profile.capital.nameEn ?? '—'],
    ['地区', [profile.regionZh, profile.subregion].filter(Boolean).join(' · ') || '—'],
    ['面积', profile.areaKm2 ? `${formatNumber(profile.areaKm2)} km²` : '—'],
    ['货币', profile.currency ? `${profile.currency.name} (${profile.currency.code})` : '—'],
    ['电话区号', profile.callingCode ?? '—'],
  ];
  for (const [label, value] of rows) {
    grid.append(
      el('div', { className: 'dossier-fact' },
        el('dt', { text: label }),
        el('dd', { text: value }),
      ),
    );
  }
  section.append(grid);
  section.append(
    el('a', {
      className: 'dossier-link',
      text: '在 Wikipedia 查看完整条目 ↗',
      attrs: { href: profile.wikipediaUrl, target: '_blank', rel: 'noreferrer' },
    }),
  );
  return section;
}

function marketSection(market: MarketCountry): HTMLElement {
  const section = dossierSection('市场数据', '世界银行 WDI · 中国海关');
  const metrics = el('div', { className: 'dossier-metrics' });
  const entries: Array<[string, string, string | null]> = [
    ['人口', formatPopulation(market.metrics.population?.value ?? null), market.metrics.population?.year ?? null],
    ['GDP', formatUsd(market.metrics.gdp?.value ?? null), market.metrics.gdp?.year ?? null],
    ['人均 GDP', formatUsdPerCapita(market.metrics.gdpPerCapita?.value ?? null), market.metrics.gdpPerCapita?.year ?? null],
    ['家庭消费', formatUsd(market.metrics.householdConsumption?.value ?? null), market.metrics.householdConsumption?.year ?? null],
    ['互联网', formatPercent(market.metrics.internetPenetration?.value ?? null), market.metrics.internetPenetration?.year ?? null],
    ['城镇化', formatPercent(market.metrics.urbanShare?.value ?? null), market.metrics.urbanShare?.year ?? null],
  ];
  for (const [label, value, year] of entries) {
    metrics.append(
      el('div', { className: 'dossier-metric' },
        el('span', { className: 'dossier-metric__label', text: label }),
        el('strong', { text: value }),
        el('span', { className: 'dossier-metric__year', text: year ?? '—' }),
      ),
    );
  }
  section.append(metrics);

  const trade = market.chinaTrade;
  if (trade) {
    section.append(
      el('div', { className: 'dossier-trade' },
        el('div', {},
          el('span', { text: `中国出口 · ${trade.year}` }),
          el('strong', { text: formatUsd(trade.exports?.value ?? null) }),
          el('small', { text: `同比 ${formatSignedPercent(trade.exports?.yoy ?? null)} · 占比 ${formatTradeShare(trade.exports?.shareOfChinaTotal ?? null)}` }),
        ),
        el('div', {},
          el('span', { text: `中国进口 · ${trade.year}` }),
          el('strong', { text: formatUsd(trade.imports?.value ?? null) }),
          el('small', { text: `同比 ${formatSignedPercent(trade.imports?.yoy ?? null)} · 占比 ${formatTradeShare(trade.imports?.shareOfChinaTotal ?? null)}` }),
        ),
      ),
    );
  }
  return section;
}

function divisionsSection(profile: CountryProfile): HTMLElement {
  const section = dossierSection('一级行政区划', 'GeoNames');
  if (!profile.divisions.length) {
    section.append(el('p', { className: 'dossier__empty', text: '暂未收录。' }));
    return section;
  }
  const list = el('ul', { className: 'dossier-list dossier-list--columns' });
  for (const division of profile.divisions) {
    list.append(
      el('li', { text: division.nameZh ?? division.name }),
    );
  }
  section.append(list);
  return section;
}

function citiesSection(profile: CountryProfile): HTMLElement {
  const section = dossierSection('主要城市', 'GeoNames · Wikidata 中文标签');
  if (!profile.cities.length) {
    section.append(el('p', { className: 'dossier__empty', text: '暂未收录。' }));
    return section;
  }
  const list = el('div', { className: 'dossier-cities' });
  for (const city of profile.cities) {
    list.append(
      el('div', { className: 'dossier-city' },
        el('div', {},
          el('strong', { text: city.nameZh ?? city.nameEn }),
          el('span', { text: city.nameEn }),
        ),
        el('div', { className: 'dossier-city__meta' },
          el('span', { text: city.nameLocal }),
          el('span', { text: city.population ? formatPopulation(city.population) : '—' }),
        ),
      ),
    );
  }
  section.append(list);
  return section;
}

function hubsSection(profile: CountryProfile): HTMLElement {
  const section = dossierSection('国际枢纽', 'OurAirports · NGA World Port Index');
  const groups: Array<['airport' | 'port' | 'logistics', string]> = [
    ['airport', '机场'],
    ['port', '港口'],
    ['logistics', '物流枢纽（铁路/公路）'],
  ];
  for (const [type, label] of groups) {
    const hubs = profile.hubs.filter((hub) => hub.type === type);
    if (!hubs.length) continue;
    section.append(el('p', { className: 'dossier-subhead', text: label }));
    const list = el('div', { className: 'dossier-hubs' });
    for (const hub of hubs) list.append(hubRow(hub));
    section.append(list);
  }
  if (!profile.hubs.length) {
    section.append(el('p', { className: 'dossier__empty', text: '暂未收录。' }));
  }
  section.append(
    el('p', { className: 'dossier-note', text: '枢纽为公开数据筛选样本，不含全部机场/港口；物流中心暂未收录。' }),
  );
  return section;
}

function hubRow(hub: ProfileHub): HTMLElement {
  return el('div', { className: 'dossier-hub' },
    el('span', {
      className: `dossier-hub__tag${hub.type === 'port' ? ' is-port' : hub.type === 'logistics' ? ' is-logistics' : ''}`,
      text: hub.type === 'airport' ? '空' : hub.type === 'port' ? '港' : '物',
    }),
    el('div', {},
      el('strong', { text: hub.nameZh ?? hub.name }),
      el('span', { text: [hub.code, hub.city].filter(Boolean).join(' · ') || '—' }),
    ),
  );
}

function hs2Section(profile: CountryProfile): HTMLElement {
  const years = [...new Set(profile.hs2.map((product) => product.year).filter(Boolean))];
  const section = dossierSection(`HS2 进口结构 · ${years.join('/') || '—'}`, 'UN Comtrade');
  if (!profile.hs2.length) {
    section.append(el('p', { className: 'dossier__empty', text: '该国 2023 年 HS2 数据暂不可得。' }));
    return section;
  }
  const list = el('div', { className: 'dossier-hs' });
  for (const product of profile.hs2) {
    list.append(
      el('div', { className: 'dossier-hs__row' },
        el('span', { className: 'dossier-hs__code', text: `HS ${product.code}` }),
        el('span', { className: 'dossier-hs__name', text: product.name }),
        el('strong', { text: `${formatPercent(product.sharePct, 1)}` }),
      ),
    );
  }
  section.append(list);
  return section;
}

function sourcesSection(profile: CountryProfile): HTMLElement {
  const section = dossierSection('覆盖与来源', '公开数据');
  section.append(
    el('p', {
      className: 'dossier-note',
      text: `行政区划 ${profile.coverage.divisions} · 城市 ${profile.coverage.cities} · 机场 ${profile.coverage.airports} · 港口 ${profile.coverage.ports} · HS2 ${profile.coverage.hs2}`,
    }),
  );
  const list = el('p', { className: 'dossier-note' });
  list.textContent = Object.entries(profile.sources)
    .map(([key, value]) => `${key}: ${value}`)
    .join('；');
  section.append(list);
  return section;
}

function dossierSection(title: string, source: string): HTMLElement {
  return el('section', { className: 'dossier-section' },
    el('div', { className: 'dossier-section__head' },
      el('h3', { text: title }),
      el('span', { text: source, attrs: { title: `数据来源：${source}` } }),
    ),
  );
}

function formatLanguages(languages: Array<{ code: string; name: string }>): string {
  if (!languages.length) return '—';
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(['zh-CN'], { type: 'language' });
  } catch {
    display = null;
  }
  return languages.map((language) => display?.of(language.code) ?? language.name).join(' / ');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}
