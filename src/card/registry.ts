import type { CardContentRenderer, CardRendererFactory } from './types';
import { createMarketRenderer } from './renderers/market';

/**
 * Content renderer registry. The shell never imports a concrete card; the
 * composition root resolves the renderer here. Add another market view by
 * dropping a renderer in `renderers/` and adding one entry.
 */
export const CARD_RENDERERS = {
  market: { label: '市场档案', create: createMarketRenderer },
} as const satisfies Record<string, { label: string; create: CardRendererFactory }>;

export type CardRendererId = keyof typeof CARD_RENDERERS;

export function isCardRendererId(value: unknown): value is CardRendererId {
  return typeof value === 'string' && Object.hasOwn(CARD_RENDERERS, value);
}

export function resolveCardRenderer(id: string | null | undefined): CardContentRenderer {
  const key = isCardRendererId(id) ? id : 'market';
  return CARD_RENDERERS[key].create();
}
