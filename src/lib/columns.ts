import type { SquadPlayer, Summary } from './types';

export type Scope = 'last10' | 'last30' | 'last100' | 'lifetime';

export const SCOPES: Array<{ key: Scope; label: string }> = [
  { key: 'last10', label: 'Last 10' },
  { key: 'last30', label: 'Last 30' },
  { key: 'last100', label: 'Last 100' },
  { key: 'lifetime', label: 'Lifetime' }
];

export interface Column {
  key: string;
  /** Short header text. */
  label: string;
  /** Full name, used for the header's title and accessible name. */
  title: string;
  digits: number;
  suffix?: string;
  /** Sort descending first when true (bigger is better or more interesting). */
  descending: boolean;
  value: (player: SquadPlayer, scope: Scope) => number | null;
}

const summary = (player: SquadPlayer, scope: Scope): Summary | null =>
  scope === 'lifetime' ? null : player.form[scope];

/** A column with the same meaning across scopes: per-match summaries or FACEIT's lifetime record. */
function shared(
  key: string,
  label: string,
  title: string,
  digits: number,
  fromSummary: (s: Summary) => number,
  fromLifetime: (player: SquadPlayer) => number | null,
  suffix?: string
): Column {
  return {
    key,
    label,
    title,
    digits,
    suffix,
    descending: true,
    value: (player, scope) => {
      if (scope === 'lifetime') return player.lifetime ? fromLifetime(player) : null;
      const s = summary(player, scope);
      return s ? fromSummary(s) : null;
    }
  };
}

function perMatch(
  key: string,
  label: string,
  title: string,
  digits: number,
  pick: (s: Summary) => number
): Column {
  return {
    key,
    label,
    title,
    digits,
    descending: true,
    value: (player, scope) => {
      const s = summary(player, scope);
      return s ? pick(s) : null;
    }
  };
}

function lifetimeOnly(
  key: string,
  label: string,
  title: string,
  digits: number,
  pick: (player: SquadPlayer) => number | null,
  suffix?: string
): Column {
  return {
    key,
    label,
    title,
    digits,
    suffix,
    descending: true,
    value: (player) => (player.lifetime ? pick(player) : null)
  };
}

/** Columns whose numbers follow the selected scope. */
export const PERFORMANCE: Column[] = [
  shared('matches', 'Matches', 'Matches', 0, (s) => s.matches, (p) => p.lifetime!.matches),
  shared('winRate', 'Win', 'Win rate', 0, (s) => s.winRate, (p) => p.lifetime!.winRate, '%'),
  shared('kd', 'K/D', 'Kill/death ratio', 2, (s) => s.kd, (p) => p.lifetime!.kd),
  shared('kr', 'K/R', 'Kills per round', 2, (s) => s.kr, (p) => p.lifetime!.kr),
  shared('adr', 'ADR', 'Average damage per round', 1, (s) => s.adr, (p) => p.lifetime!.adr),
  shared('hs', 'HS', 'Headshot kills', 0, (s) => s.headshots, (p) => p.lifetime!.headshots, '%')
];

/** Only FACEIT's per-match stats have these. */
export const MATCH_ONLY: Column[] = [
  perMatch('avgKills', 'Kills', 'Kills per match', 1, (s) => s.avgKills),
  perMatch('avgAssists', 'Assists', 'Assists per match', 1, (s) => s.avgAssists),
  perMatch('mvps', 'MVPs', 'MVPs per match', 1, (s) => s.mvpsPerMatch),
  perMatch('triples', '3K', 'Triple kills', 0, (s) => s.tripleKills),
  perMatch('quads', '4K', 'Quadro kills', 0, (s) => s.quadroKills),
  perMatch('aces', '5K', 'Aces', 0, (s) => s.pentaKills)
];

/** Only FACEIT's lifetime record has these. */
export const LIFETIME_ONLY: Column[] = [
  lifetimeOnly('entryRate', 'Entry', 'Rounds with an opening duel', 0, (p) => p.lifetime!.entryRate, '%'),
  lifetimeOnly('entrySuccess', 'Entry win', 'Opening duels won', 0, (p) => p.lifetime!.entrySuccess, '%'),
  lifetimeOnly('clutch1v1', '1v1', '1v1 clutches won', 0, (p) => p.lifetime!.clutch1v1, '%'),
  lifetimeOnly('clutch1v2', '1v2', '1v2 clutches won', 0, (p) => p.lifetime!.clutch1v2, '%'),
  lifetimeOnly('utility', 'Util', 'Utility damage per round', 1, (p) => p.lifetime!.utilityDamagePerRound),
  lifetimeOnly('flash', 'Flash', 'Flashes that blinded an enemy', 0, (p) => p.lifetime!.flashSuccess, '%'),
  lifetimeOnly('flashed', 'Blinded', 'Enemies flashed per round', 2, (p) => p.lifetime!.enemiesFlashedPerRound),
  lifetimeOnly('sniper', 'AWP', 'Kills with a sniper rifle', 0, (p) => p.lifetime!.sniperKillShare, '%'),
  lifetimeOnly('streak', 'Best run', 'Longest win streak', 0, (p) => p.lifetime!.longestStreak)
];

export const PROFILE: Column[] = [
  { key: 'elo', label: 'ELO', title: 'FACEIT ELO', digits: 0, descending: true, value: (p) => p.elo || null },
  {
    key: 'regionRank',
    label: 'Region',
    title: 'Position in the regional ladder',
    digits: 0,
    descending: false,
    value: (p) => p.regionRank
  },
  {
    key: 'countryRank',
    label: 'Country',
    title: 'Position in the national ladder',
    digits: 0,
    descending: false,
    value: (p) => p.countryRank
  },
  {
    key: 'played30',
    label: '30d',
    title: 'Matches in the last 30 days',
    digits: 0,
    descending: true,
    value: (p) => p.played.days30
  }
];

export const ALL_COLUMNS = [...PROFILE, ...PERFORMANCE, ...MATCH_ONLY, ...LIFETIME_ONLY];

export function formatValue(column: Column, value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const text =
    column.digits === 0 && Math.abs(value) >= 10_000
      ? Math.round(value).toLocaleString('en-GB')
      : value.toFixed(column.digits);
  return column.suffix ? `${text}${column.suffix}` : text;
}

/** Sorts players by a column; empty values always go last. */
export function sortPlayers(
  players: SquadPlayer[],
  column: Column,
  scope: Scope,
  direction: 'asc' | 'desc'
) {
  const sign = direction === 'asc' ? 1 : -1;
  return [...players].sort((a, b) => {
    const x = column.value(a, scope);
    const y = column.value(b, scope);
    if (x === null && y === null) return a.displayName.localeCompare(b.displayName);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sign || a.displayName.localeCompare(b.displayName);
  });
}

export const isActive = (player: SquadPlayer) => player.played.days90 > 0;
