import type { MarketCountry } from '../data/types';

export type CardMode = 'preview' | 'pinned';

/** Actions the shell exposes to content renderers. */
export interface CardActions {
  close(): void;
  pin(): void;
}

/**
 * Everything a content renderer is allowed to know. Add fields here when new
 * content needs them — renderers stay independent of globe state and DOM shell.
 */
export interface CardRenderContext {
  readonly country: MarketCountry;
  readonly mode: CardMode;
  readonly actions: CardActions;
}

export interface CardContentHandle {
  /** Root node owned by the renderer; the shell only inserts and removes it. */
  readonly element: HTMLElement;
  /** Optional in-place update (mode change, live data, locale switch, ...). */
  update?(ctx: CardRenderContext): void;
  /** Optional cleanup for listeners/timers owned by the content. */
  destroy?(): void;
}

export interface CardContentRenderer {
  readonly id: string;
  readonly label?: string;
  create(ctx: CardRenderContext): CardContentHandle;
}

export type CardRendererFactory = () => CardContentRenderer;
