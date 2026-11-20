import type { MarketCountry, MetricValue } from '../../data/types';
import { el } from '../dom';

/** Shared visual primitives for market content renderers. */
export function marketHero(
  market: MarketCountry,
  eyebrow: string,
  trailing?: Node,
): HTMLElement {
  const meta = el('div', { className: 'card-ident' });
  if (market.nameEn) {
    meta.append(el('span', { className: 'card-ident__name', text: market.nameEn }));
  }
  if (trailing) meta.append(trailing);

  return el(
    'header',
    { className: 'card-hero' },
    el(
      'div',
      { className: 'card-flag', attrs: { 'aria-hidden': 'true' } },
      market.profile?.flagUrl
        ? el('img', { attrs: { src: market.profile.flagUrl, alt: '' } })
        : market.flag ?? market.nameZh.slice(0, 2),
    ),
    el(
      'div',
      { className: 'card-heading' },
      el('p', { className: 'card-eyebrow', text: eyebrow }),
      el('h2', { className: 'card-title', text: market.nameZh }),
      meta.childElementCount > 0 ? meta : null,
    ),
  );
}

export function metricCell(
  label: string,
  metric: MetricValue | null,
  formatter: (value: number | null) => string,
): HTMLElement {
  return el(
    'div',
    { className: 'market-metric' },
    el('span', { className: 'market-metric__label', text: label }),
    el('strong', { className: 'market-metric__value', text: formatter(metric?.value ?? null) }),
    el('span', {
      className: 'market-metric__year',
      text: metric?.year ? `${metric.year}` : '暂无',
    }),
  );
}

export function chip(text: string, variant = 'default'): HTMLElement {
  return el('span', {
    className: `chip${variant === 'default' ? '' : ` chip--${variant}`}`,
    text,
  });
}

export function sectionLabel(text: string, source?: string): HTMLElement {
  return el('p', {
    className: 'card-section-label',
    text,
    attrs: source ? { title: `数据来源：${source}` } : {},
  });
}

export function sourceNote(text: string): HTMLElement {
  return el('p', { className: 'card-source card-source--market', text });
}

export function marketNote(text: string, className = 'market-hint'): HTMLElement {
  return el('p', { className, text });
}
