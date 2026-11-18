import type { ScreenPoint, Size } from '../shared/coords';

export interface CardPositionOptions {
  /** Gap between the pointer and the card. */
  offset?: number;
  /** Minimum gap between the card and the viewport edge. */
  gutter?: number;
}

export interface CardPlacement {
  x: number;
  y: number;
  horizontal: 'right' | 'left' | 'clamped';
  vertical: 'below' | 'above' | 'clamped';
}

/**
 * Pick a viewport position for the hover card. Prefers right/below the
 * pointer, flips on overflow, and only then clamps into the viewport.
 * Pure so it can be tested without a browser.
 */
export function computeCardPosition(
  point: ScreenPoint,
  card: Size,
  viewport: Size,
  options: CardPositionOptions = {},
): CardPlacement {
  const offset = options.offset ?? 18;
  const gutter = options.gutter ?? 12;

  const maxX = Math.max(gutter, viewport.width - card.width - gutter);
  const maxY = Math.max(gutter, viewport.height - card.height - gutter);

  let x: number;
  let horizontal: CardPlacement['horizontal'];
  if (point.x + offset + card.width + gutter <= viewport.width) {
    x = point.x + offset;
    horizontal = 'right';
  } else if (point.x - offset - card.width >= gutter) {
    x = point.x - offset - card.width;
    horizontal = 'left';
  } else {
    x = clamp(point.x + offset, gutter, maxX);
    horizontal = 'clamped';
  }

  let y: number;
  let vertical: CardPlacement['vertical'];
  if (point.y + offset + card.height + gutter <= viewport.height) {
    y = point.y + offset;
    vertical = 'below';
  } else if (point.y - offset - card.height >= gutter) {
    y = point.y - offset - card.height;
    vertical = 'above';
  } else {
    y = clamp(point.y + offset, gutter, maxY);
    vertical = 'clamped';
  }

  return { x, y, horizontal, vertical };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
