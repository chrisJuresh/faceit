export const round = (value: number, precision = 1) => {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

export function statNumber(
  stats: Record<string, string | number | null | string[]> | undefined,
  ...keys: string[]
): number {
  if (!stats) return 0;
  for (const key of keys) {
    const raw = stats[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw.replace('%', '').trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

/** Like statNumber, but null when FACEIT did not return the stat at all. */
export function optionalStat(
  stats: Record<string, string | number | null | string[]> | undefined,
  key: string
): number | null {
  const raw = stats?.[key];
  if (raw === undefined || raw === null || raw === '' || Array.isArray(raw)) return null;
  const value = statNumber(stats, key);
  return Number.isFinite(value) ? value : null;
}

export function normalizeFaceitUrl(value: string | undefined, fallback: string) {
  return (value || fallback).replace('{lang}', 'en');
}

export function displayMap(value: string) {
  const map = value.replace(/^(de|cs)_/, '').replaceAll('_', ' ');
  return map ? map.charAt(0).toUpperCase() + map.slice(1) : 'Unknown';
}

// Image URLs end up inside an inline CSS url(), and other URLs in hrefs, so only accept plain
// https URLs.
export const safeImage = (value: string | undefined) =>
  value && /^https:\/\/[^\s'"()\\]+$/.test(value) ? value : '';
