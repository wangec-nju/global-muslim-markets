const ICONS = {
  close: `
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
  pin: `
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M9.4 1.9l4.7 4.7-2 .8-1.8 3.9-2.1-2.1L3 12.7l-.7-.7 3.5-5.2-2.1-2.1 3.9-1.8.8-2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`,
  globe: `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2"/>
      <path d="M3.4 9.6h17.2M3.4 14.4h17.2M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z" stroke="currentColor" stroke-width="1.2"/>
    </svg>`,
} as const;

export type IconName = keyof typeof ICONS;

/** Icons are static, trusted markup; all dynamic text goes through textContent. */
export function icon(name: IconName): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = ICONS[name].trim();
  return template.content.firstElementChild as SVGSVGElement;
}
