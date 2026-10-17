import type { LifetimeStats, SquadPlayer, Summary } from './types';

export type Scope = 'last10' | 'last30' | 'last100' | 'lifetime';
export type View = 'overview' | 'duels';

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
  /** Full name, used for the header's title. */
  title: string;
  digits: number;
  suffix?: string;
  /** Sort descending first when true. */
  descending: boolean;
  value: (player: SquadPlayer, scope: Scope) => number | null;
  /** Display text when it isn't just the formatted value (e.g. a W–L record). */
  text?: (player: SquadPlayer, scope: Scope) => string | null;
  /** Small sample-size figure shown beside the value. */
  sample?: (player: SquadPlayer) => number | null;
}

export interface ColumnGroup {
  label: string;
  columns: Column[];
}

/** Recent scopes read FACEIT's per-match stats; lifetime reads FACEIT's lifetime record. */
function scoped(
  key: string,
  label: string,
  title: string,
  digits: number,
  fromSummary: (s: Summary) => number,
  fromLifetime: (life: LifetimeStats) => number | null,
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
      if (scope === 'lifetime') return player.lifetime ? fromLifetime(player.lifetime) : null;
      const summary = player.form[scope];
      return summary ? fromSummary(summary) : null;
    }
  };
}

function lifetime(
  key: string,
  label: string,
  title: string,
  digits: number,
  pick: (life: LifetimeStats) => number | null,
  suffix?: string,
  sample?: (life: LifetimeStats) => number
): Column {
  return {
    key,
    label,
    title,
    digits,
    suffix,
    descending: true,
    value: (player) => (player.lifetime ? pick(player.lifetime) : null),
    sample: sample ? (player) => (player.lifetime ? sample(player.lifetime) : null) : undefined
  };
}

export const ELO: Column = {
  key: 'elo',
  label: 'ELO',
  title: 'FACEIT ELO',
  digits: 0,
  descending: true,
  value: (player) => player.elo || null
};

const matches = scoped('matches', 'M', 'Matches', 0, (s) => s.matches, (l) => l.matches);
const record: Column = {
  key: 'record',
  label: 'W–L',
  title: 'Wins and losses (sorted by wins)',
  digits: 0,
  descending: true,
  value: (player, scope) =>
    scope === 'lifetime' ? (player.lifetime?.wins ?? null) : (player.form[scope]?.wins ?? null),
  text: (player, scope) => {
    if (scope === 'lifetime') {
      const life = player.lifetime;
      return life ? `${life.wins}–${life.matches - life.wins}` : null;
    }
    const summary = player.form[scope];
    return summary ? `${summary.wins}–${summary.losses}` : null;
  }
};

export const OVERVIEW: ColumnGroup[] = [
  {
    label: 'Record',
    columns: [matches, record, scoped('winRate', 'Win %', 'Win rate', 0, (s) => s.winRate, (l) => l.winRate)]
  },
  {
    label: 'Fragging',
    columns: [
      scoped('kd', 'K/D', 'Kills per death', 2, (s) => s.kd, (l) => l.kd),
      scoped('kr', 'K/R', 'Kills per round', 2, (s) => s.kr, (l) => l.kr),
      scoped('adr', 'ADR', 'Average damage per round', 1, (s) => s.adr, (l) => l.adr),
      scoped('hs', 'HS %', 'Kills that were headshots', 0, (s) => s.headshots, (l) => l.headshots)
    ]
  },
  {
    label: 'Per match',
    columns: [
      scoped('kills', 'Kills', 'Kills per match', 1, (s) => s.avgKills, (l) => l.avgKills),
      scoped('assists', 'Assists', 'Assists per match', 1, (s) => s.avgAssists, (l) => l.avgAssists),
      scoped('mvps', 'MVPs', 'MVPs per match', 1, (s) => s.mvpsPerMatch, (l) => l.mvpsPerMatch)
    ]
  },
  {
    label: 'Multi-kills',
    columns: [
      scoped('triples', '3K', 'Triple kills', 0, (s) => s.tripleKills, (l) => l.tripleKills),
      scoped('quads', '4K', 'Quadro kills', 0, (s) => s.quadroKills, (l) => l.quadroKills),
      scoped('aces', '5K', 'Aces', 0, (s) => s.pentaKills, (l) => l.pentaKills)
    ]
  }
];

/** Only FACEIT's lifetime record has these. */
export const DUELS: ColumnGroup[] = [
  {
    label: 'Entry',
    columns: [
      lifetime('entryRate', 'Rate %', 'Rounds with an opening duel', 0, (l) => l.entryRate),
      lifetime('entrySuccess', 'Won %', 'Opening duels won', 0, (l) => l.entrySuccess)
    ]
  },
  {
    label: 'Clutch',
    columns: [
      lifetime('clutch1v1', '1v1 %', '1v1 clutches won', 0, (l) => l.clutch1v1, undefined, (l) => l.clutch1v1Count),
      lifetime('clutch1v2', '1v2 %', '1v2 clutches won', 0, (l) => l.clutch1v2, undefined, (l) => l.clutch1v2Count)
    ]
  },
  {
    label: 'Utility',
    columns: [
      lifetime('utility', 'Dmg/rd', 'Utility damage per round', 1, (l) => l.utilityDamagePerRound),
      lifetime('utilitySuccess', 'Hit %', 'Utility that damaged or blinded an enemy', 0, (l) => l.utilitySuccess)
    ]
  },
  {
    label: 'Flash',
    columns: [
      lifetime('flashSuccess', 'Hit %', 'Flashes that blinded an enemy', 0, (l) => l.flashSuccess),
      lifetime('flashes', 'Per rd', 'Flashes thrown per round', 2, (l) => l.flashesPerRound),
      lifetime('blinded', 'Blinded/rd', 'Enemies blinded per round', 2, (l) => l.enemiesFlashedPerRound)
    ]
  },
  {
    label: 'Sniper',
    columns: [lifetime('sniper', 'Kills %', 'Kills with a sniper rifle', 1, (l) => l.sniperKillShare)]
  },
  {
    label: 'Win streak',
    columns: [
      lifetime('streak', 'Now', 'Current win streak', 0, (l) => l.currentStreak),
      lifetime('bestStreak', 'Best', 'Longest win streak', 0, (l) => l.longestStreak)
    ]
  }
];

export const allColumns = (groups: ColumnGroup[]) => [ELO, ...groups.flatMap((group) => group.columns)];

export function formatValue(column: Column, value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const text =
    column.digits === 0 && Math.abs(value) >= 1000
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
