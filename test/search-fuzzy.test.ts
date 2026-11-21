import { describe, expect, it } from 'vitest';
import { normalizeSearch, scoreSearch } from '../src/search/fuzzy';

const saudi = {
  label: '沙特阿拉伯',
  subtitle: 'Saudi Arabia · 西亚',
  haystack: '国家 沙特阿拉伯 saudi arabia riyadh 利雅得',
};

const indonesia = {
  label: '印度尼西亚',
  subtitle: 'Indonesia · 东南亚',
  haystack: '国家 印度尼西亚 indonesia jakarta 雅加达',
};

describe('search fuzzy matching', () => {
  it('normalizes accents and punctuation', () => {
    expect(normalizeSearch('Côte d’Ivoire')).toBe('cote d ivoire');
  });

  it('matches prefixes, Chinese substrings, and typos', () => {
    expect(scoreSearch(saudi, '沙特')).not.toBeNull();
    expect(scoreSearch(saudi, 'saud')).not.toBeNull();
    expect(scoreSearch(saudi, 'saudia')).not.toBeNull();
    expect(scoreSearch(saudi, 'riyad')).not.toBeNull();
    expect(scoreSearch(indonesia, 'indonesa')).not.toBeNull();
  });

  it('supports compact subsequences such as airport-style codes', () => {
    expect(scoreSearch(indonesia, 'jkt')).not.toBeNull();
  });

  it('rejects unrelated queries', () => {
    expect(scoreSearch(saudi, 'zzzz')).toBeNull();
  });
});
