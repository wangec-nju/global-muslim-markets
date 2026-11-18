import { describe, expect, it } from 'vitest';
import { computeCardPosition } from '../src/card/position';

describe('computeCardPosition', () => {
  const card = { width: 300, height: 200 };
  const viewport = { width: 1000, height: 800 };

  it('prefers the lower-right side of the pointer', () => {
    const position = computeCardPosition({ x: 100, y: 100 }, card, viewport);
    expect(position).toMatchObject({ x: 118, y: 118, horizontal: 'right', vertical: 'below' });
  });

  it('flips horizontally near the right edge', () => {
    const position = computeCardPosition({ x: 900, y: 100 }, card, viewport);
    expect(position.x).toBe(582);
    expect(position.horizontal).toBe('left');
  });

  it('flips vertically near the bottom edge', () => {
    const position = computeCardPosition({ x: 100, y: 700 }, card, viewport);
    expect(position.y).toBe(482);
    expect(position.vertical).toBe('above');
  });

  it('clamps into a viewport that is smaller than the card', () => {
    const position = computeCardPosition(
      { x: 160, y: 150 },
      card,
      { width: 320, height: 300 },
    );
    expect(position.x).toBe(12);
    expect(position.y).toBe(88);
    expect(position.horizontal).toBe('clamped');
    expect(position.vertical).toBe('clamped');
  });

  it('honours custom offset and gutter', () => {
    const position = computeCardPosition(
      { x: 50, y: 50 },
      card,
      viewport,
      { offset: 30, gutter: 20 },
    );
    expect(position.x).toBe(80);
    expect(position.y).toBe(80);
  });
});
