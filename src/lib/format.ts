export const fixed = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);

export const thousands = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString('en-GB');

/** "13–9", or a dash when FACEIT gave no score. */
export const score = (ours: number | null | undefined, theirs: number | null | undefined) =>
  ours === null || ours === undefined || theirs === null || theirs === undefined ? '—' : `${ours}–${theirs}`;

/** Kills over deaths for one match; a deathless match counts its kills. */
export const kd = (kills: number, deaths: number) => (deaths ? kills / deaths : kills);

/** Share of kills that were headshots, as a whole percentage. */
export const headshotRate = (headshots: number, kills: number) => (kills ? Math.round((headshots / kills) * 100) : 0);

/** "+4", "−3", "0". */
export const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');

/** Compact age for tables and lists: "now", "12m", "5h", "4d", "3mo", "2y". */
export function age(timestamp: number | null, now: number) {
  if (!timestamp) return '—';
  const seconds = Math.max(0, now - timestamp);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function timeAgo(timestamp: number | null, now: number) {
  const text = age(timestamp, now);
  return text === '—' ? text : text === 'now' ? 'just now' : `${text} ago`;
}

export function shortDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(timestamp * 1000)
  );
}

export function monthYear(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(timestamp * 1000)
  );
}

/**
 * Absolute time for tooltips. Pinned to UTC so the server render and the browser agree;
 * visible times on the page are relative ("4d ago") instead.
 */
export function dateTime(timestamp: number) {
  return `${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(timestamp * 1000))} UTC`;
}

export function duration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}

/** A running clock: "25:13", or "1:05:13" past the hour. */
export function stopwatch(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export const roomUrl = (matchId: string) => `https://www.faceit.com/en/cs2/room/${encodeURIComponent(matchId)}`;
