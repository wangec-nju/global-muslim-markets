const REGION_ZH: Record<string, string> = {
  Africa: '非洲',
  Americas: '美洲',
  Antarctic: '南极洲',
  Antarctica: '南极洲',
  Asia: '亚洲',
  Europe: '欧洲',
  Oceania: '大洋洲',
};

const SUBREGION_ZH: Record<string, string> = {
  'Australia and New Zealand': '澳新地区',
  Caribbean: '加勒比地区',
  'Central America': '中美洲',
  'Central Asia': '中亚',
  'Central Europe': '中欧',
  'Eastern Africa': '东非',
  'Eastern Asia': '东亚',
  'Eastern Europe': '东欧',
  Melanesia: '美拉尼西亚',
  Micronesia: '密克罗尼西亚',
  'Middle Africa': '中非',
  'North America': '北美',
  'Northern Africa': '北非',
  'Northern Europe': '北欧',
  Polynesia: '波利尼西亚',
  'South America': '南美',
  'South-Eastern Asia': '东南亚',
  'Southeast Europe': '东南欧',
  'Southern Africa': '南部非洲',
  'Southern Asia': '南亚',
  'Southern Europe': '南欧',
  'Western Africa': '西非',
  'Western Asia': '西亚',
  'Western Europe': '西欧',
};

export function regionLabel(region: string | null | undefined): string | null {
  if (!region) return null;
  return REGION_ZH[region] ?? region;
}

export function subregionLabel(subregion: string | null | undefined): string | null {
  if (!subregion) return null;
  return SUBREGION_ZH[subregion] ?? subregion;
}

export function formatArea(area: number | null): string | null {
  if (area == null || !Number.isFinite(area) || area <= 0) return null;
  if (area >= 10000) {
    const value = area / 10000;
    return `${new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: value >= 100 ? 0 : 1,
    }).format(value)} 万 km²`;
  }
  return `${new Intl.NumberFormat('zh-CN').format(Math.round(area))} km²`;
}
