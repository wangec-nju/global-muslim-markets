import type { CardContentRenderer, CardRendererFactory } from './types';
import { createOverviewRenderer } from './renderers/overview';
import { createMarketRenderer } from './renderers/market';

/**
 * Content renderer registry. Add a new card type by dropping a renderer in
 * `renderers/` and adding one entry here — the card shell stays untouched.
 */
export const CARD_RENDERERS = {
  overview: { label: '国家概览', create: createOverviewRenderer },
  market: { label: '市场档案', create: createMarketRenderer },
} as const satisfies Record<string, { label: string; create: CardRendererFactory }>;

export type CardRendererId = keyof typeof CARD_RENDERERS;

export function isCardRendererId(value: unknown): value is CardRendererId {
  return typeof value === 'string' && Object.hasOwn(CARD_RENDERERS, value);
}

export function resolveCardRenderer(id: string | null | undefined): CardContentRenderer {
  const key = isCardRendererId(id) ? id : 'overview';
  return CARD_RENDERERS[key].create();
}

export function listCardRenderers(): Array<{ id: CardRendererId; label: string }> {
  return (Object.keys(CARD_RENDERERS) as CardRendererId[]).map((id) => ({
    id,
    label: CARD_RENDERERS[id].label,
  }));
}
