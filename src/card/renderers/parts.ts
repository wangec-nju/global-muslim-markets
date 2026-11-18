import type { CountryDetail } from '../../data/types';
import { el } from '../dom';

/** Shared visual primitives available to any content renderer. */
export function countryHero(
  country: CountryDetail,
  eyebrow: string,
  trailing?: Node,
): HTMLElement {
  const codes = el('span', { className: 'card-codes' });
  if (country.iso2) codes.append(el('span', { className: 'chip chip--code', text: country.iso2 }));
  if (country.iso3) codes.append(el('span', { className: 'chip chip--code', text: country.iso3 }));

  const meta = el('div', { className: 'card-ident' });
  if (country.name && country.name !== country.label) {
    meta.append(el('span', { className: 'card-ident__name', text: country.name }));
  }
  if (codes.childElementCount > 0) meta.append(codes);
  if (trailing) meta.append(trailing);

  return el(
    'header',
    { className: 'card-hero' },
    el(
      'div',
      { className: 'card-flag', attrs: { 'aria-hidden': 'true' } },
      country.flag ?? country.label.slice(0, 2).toUpperCase(),
    ),
    el(
      'div',
      { className: 'card-heading' },
      el('p', { className: 'card-eyebrow', text: eyebrow }),
      el('h2', { className: 'card-title', text: country.label }),
      meta.childElementCount > 0 ? meta : null,
    ),
  );
}

export function metaItem(label: string, value: string | null | undefined): HTMLElement {
  return el(
    'div',
    { className: 'card-meta__item' },
    el('dt', { text: label }),
    el('dd', { text: value || '—' }),
  );
}

export function chip(text: string, variant = 'default'): HTMLElement {
  return el('span', {
    className: `chip${variant === 'default' ? '' : ` chip--${variant}`}`,
    text,
  });
}

export function sourceNote(text: string): HTMLElement {
  return el('p', { className: 'card-source', text });
}

export function emptyState(title: string, body: string): HTMLElement {
  return el(
    'div',
    { className: 'card-empty' },
    el('span', { className: 'card-empty__glyph', attrs: { 'aria-hidden': 'true' }, text: '◇' }),
    el('p', { className: 'card-empty__title', text: title }),
    el('p', { className: 'card-empty__body', text: body }),
  );
}
