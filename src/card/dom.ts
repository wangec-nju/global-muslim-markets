type AttributeValue = string | number | boolean | null | undefined;
type Child = Node | string | null | undefined | false;

export interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, AttributeValue>;
  dataset?: Record<string, string>;
}

/** Tiny DOM builder that keeps content renderers free of untrusted innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value == null || value === false) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }

  for (const [name, value] of Object.entries(options.dataset ?? {})) {
    node.dataset[name] = value;
  }

  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child);
  }

  return node;
}

export function text(value: string | number | null | undefined): string {
  return value == null || value === '' ? '—' : String(value);
}
