const zhNumber = new Intl.NumberFormat('zh-CN');

/** Chinese compact units for population-like values. */
export function formatPopulation(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if (absolute >= 1e8) return `${trim(value / 1e8)} 亿`;
  if (absolute >= 1e4) return `${trim(value / 1e4, 1)} 万`;
  return zhNumber.format(Math.round(value));
}

/** USD amounts in Chinese units, e.g. 1.45 万亿美元 / 7,984 亿美元. */
export function formatUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1e12) return `${trim(value / 1e12)} 万亿美元`;
  if (value >= 1e8) return `${trim(value / 1e8, 1)} 亿美元`;
  if (value >= 1e4) return `${trim(value / 1e4, 1)} 万美元`;
  return `$${zhNumber.format(Math.round(value))}`;
}

export function formatUsdPerCapita(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${zhNumber.format(Math.round(value))}`;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

/** Trade shares can be a fraction of a percent; avoid turning them into 0.00%. */
export function formatTradeShare(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '0%';
  const absolute = Math.abs(value);
  if (absolute < 0.001) return '<0.001%';
  if (absolute < 0.1) return `${value.toFixed(3)}%`;
  return `${value.toFixed(2)}%`;
}

function trim(value: number, digits = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}
