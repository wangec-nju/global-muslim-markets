import { describe, expect, it } from 'vitest';
import {
  isCardRendererId,
  listCardRenderers,
  resolveCardRenderer,
} from '../src/card/registry';

describe('card renderer registry', () => {
  it('resolves every registered renderer', () => {
    for (const { id } of listCardRenderers()) {
      const renderer = resolveCardRenderer(id);
      expect(renderer.id).toBe(id);
      expect(typeof renderer.create).toBe('function');
    }
  });

  it('falls back to the overview renderer for unknown ids', () => {
    expect(resolveCardRenderer('unknown').id).toBe('overview');
    expect(resolveCardRenderer(null).id).toBe('overview');
  });

  it('guards URL-provided ids', () => {
    expect(isCardRendererId('market')).toBe(true);
    expect(isCardRendererId('__proto__')).toBe(false);
    expect(isCardRendererId('')).toBe(false);
  });
});
