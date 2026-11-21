export interface FuzzyTarget {
  label: string;
  subtitle: string;
  haystack: string;
}

/** Normalize accents, case, punctuation and whitespace for matching. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score a result. Lower is better; null means no match.
 *
 * Exact/prefix matches come first, then all-token matches, then one-edit
 * spelling tolerance for Latin words. Chinese is handled as character
 * substring/subsequence because word boundaries are not useful there.
 */
export function scoreSearch(target: FuzzyTarget, rawQuery: string): number | null {
  const query = normalizeSearch(rawQuery);
  if (!query) return null;

  const label = normalizeSearch(target.label);
  const subtitle = normalizeSearch(target.subtitle);
  const haystack = normalizeSearch(target.haystack);
  const compactHaystack = haystack.replace(/\s+/g, '');

  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  if (subtitle.includes(query)) return 3;
  if (haystack.includes(query)) return 4;

  const tokens = query.split(' ').filter(Boolean);
  if (!tokens.length) return null;

  let total = 0;
  let fuzzy = false;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      total += 10;
      continue;
    }
    const compactToken = token.replace(/\s+/g, '');
    if (compactHaystack.includes(compactToken)) {
      total += 12;
      continue;
    }

    const best = bestTokenMatch(token, haystack);
    if (best == null) {
      const sub = subsequenceScore(token, compactHaystack);
      if (sub == null) return null;
      total += sub;
      fuzzy = true;
      continue;
    }
    total += best;
    fuzzy = fuzzy || best >= 30;
  }

  // A query like "jkt" can also be matched as a whole compact subsequence.
  if (!fuzzy && tokens.every((token) => token.length >= 3)) {
    const sub = subsequenceScore(query, compactHaystack);
    if (sub != null) total = Math.min(total, sub);
  }

  return total;
}

function bestTokenMatch(token: string, haystack: string): number | null {
  if (token.length < 3) return null;
  const words = haystack.split(' ').filter(Boolean);
  let best: number | null = null;

  for (const word of words) {
    if (word.startsWith(token)) return 20;
    if (word.includes(token)) return 22;
    const distance = levenshtein(token, word, maxDistance(token));
    if (distance != null) {
      const score = 30 + distance;
      if (best == null || score < best) best = score;
    }
  }

  return best;
}

function subsequenceScore(query: string, haystack: string): number | null {
  if (query.length < 3 || haystack.length < query.length) return null;
  let index = 0;
  for (const char of haystack) {
    if (char === query[index]) index += 1;
    if (index === query.length) return 40;
  }
  return null;
}

function maxDistance(token: string): number {
  if (token.length <= 4) return 1;
  if (token.length <= 7) return 2;
  return 3;
}

/** Bounded Levenshtein distance; null when it exceeds `max`. */
function levenshtein(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null;
  const previous: number[] = [];
  const current: number[] = [];
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = current[0] ?? i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      rowMin = Math.min(rowMin, current[j] ?? i);
    }
    if (rowMin > max) return null;
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] ?? 0;
  }

  const result = previous[b.length] ?? 0;
  return result <= max ? result : null;
}
