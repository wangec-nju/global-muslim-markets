import { describe, expect, it } from 'vitest';
import { isCardRendererId, resolveCardRenderer } from '../src/card/registry';

describe('card renderer registry', () => {
  it('resolves the market renderer', () => {
    const renderer = resolveCardRenderer('market');
    expect(renderer.id).toBe('market');
    expect(typeof renderer.create).toBe('function');
  });

  it('falls back to the market renderer for unknown ids', () => {
    expect(resolveCardRenderer('unknown').id).toBe('market');
    expect(resolveCardRenderer(null).id).toBe('market');
  });

  it('guards URL-provided ids', () => {
    expect(isCardRendererId('market')).toBe(true);
    expect(isCardRendererId('__proto__')).toBe(false);
    expect(isCardRendererId('')).toBe(false);
  });
});
