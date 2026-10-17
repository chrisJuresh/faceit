import type { LifetimeStats, SquadPlayer, Summary } from './types';

export type Scope = 'last10' | 'last30' | 'last100' | 'lifetime';
export type View = 'core' | 'duels';

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
  value: (player: SquadPlayer, scope: Scope) => number | null;
  /** Display text when it isn't just the formatted value (e.g. a W–L record). */
  text?: (player: SquadPlayer, scope: Scope) => string | null;
  /** Coloured by which side of 1.0 it falls (K/D). */
  aroundOne?: boolean;
  /** Zero is the usual value, so it is shown muted. */
  quietZero?: boolean;
  /** A sample-size column beside a rate: always muted. */
  isSample?: boolean;
  /** The value is muted when this sample is under 10. */
  sample?: (player: SquadPlayer) => number | null;
  /** Drawn by the table as the last-10 result strip; not sortable. */
  strip?: boolean;
  /** A timestamp, shown as its age. */
  age?: boolean;
}

export interface ColumnGroup {
  label: string;
  columns: Column[];
}

type ColumnOptions = Partial<Pick<Column, 'text' | 'aroundOne' | 'quietZero' | 'isSample' | 'sample'>>;

/** Recent scopes read FACEIT's per-match stats; lifetime reads FACEIT's lifetime record. */
function scoped(
  key: string,
  label: string,
  title: string,
  digits: number,
  fromSummary: (s: Summary) => number,
  fromLifetime: (life: LifetimeStats) => number | null,
  options: ColumnOptions = {}
): Column {
  return {
    key,
    label,
    title,
    digits,
    value: (player, scope) => {
      if (scope === 'lifetime') return player.lifetime ? fromLifetime(player.lifetime) : null;
      const summary = player.form[scope];
      return summary ? fromSummary(summary) : null;
    },
    ...options
  };
}

/** Only FACEIT's per-match stats have these, so lifetime has none. */
function recent(
  key: string,
  label: string,
  title: string,
  digits: number,
  pick: (s: Summary) => number,
  options: ColumnOptions = {}
): Column {
  return scoped(key, label, title, digits, pick, () => null, options);
}

/** Only FACEIT's lifetime record has these. */
function lifetime(
  key: string,
  label: string,
  title: string,
  digits: number,
  pick: (life: LifetimeStats) => number | null,
  options: ColumnOptions = {}
): Column {
  return {
    key,
    label,
    title,
    digits,
    value: (player) => (player.lifetime ? pick(player.lifetime) : null),
    ...options
  };
}

export const ELO: Column = {
  key: 'elo',
  label: 'ELO',
  title: 'FACEIT ELO',
  digits: 0,
  value: (player) => player.elo || null
};

const RESULTS: ColumnGroup = {
  label: 'Results',
  columns: [
    scoped('matches', 'M', 'Matches', 0, (s) => s.matches, (l) => l.matches),
    {
      key: 'record',
      label: 'W–L',
      title: 'Wins and losses (sorted by wins)',
      digits: 0,
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
    },
    scoped('winRate', 'Win %', 'Win rate', 0, (s) => s.winRate, (l) => l.winRate)
  ]
};

const FRAGGING: ColumnGroup = {
  label: 'Fragging',
  columns: [
    scoped('kd', 'K/D', 'Kills per death', 2, (s) => s.kd, (l) => l.kd, { aroundOne: true }),
    scoped('kr', 'K/R', 'Kills per round', 2, (s) => s.kr, (l) => l.kr),
    scoped('adr', 'ADR', 'Average damage per round', 1, (s) => s.adr, (l) => l.adr || null),
    scoped('hs', 'HS %', 'Kills that were headshots', 0, (s) => s.headshots, (l) => l.headshots)
  ]
};

const PER_MATCH: ColumnGroup = {
  label: 'Per match',
  columns: [
    recent('kills', 'K', 'Kills per match', 1, (s) => s.avgKills),
    recent('assists', 'A', 'Assists per match', 1, (s) => s.avgAssists),
    recent('mvps', 'MVP', 'MVPs per match', 1, (s) => s.mvpsPerMatch)
  ]
};

const MULTI_KILLS: ColumnGroup = {
  label: 'Multi-kills',
  columns: [
    recent('doubles', '2K', 'Double kills', 0, (s) => s.doubleKills, { quietZero: true }),
    recent('triples', '3K', 'Triple kills', 0, (s) => s.tripleKills, { quietZero: true }),
    recent('quads', '4K', 'Quadro kills', 0, (s) => s.quadroKills, { quietZero: true }),
    recent('aces', '5K', 'Aces', 0, (s) => s.pentaKills, { quietZero: true })
  ]
};

const WIN_STREAK: ColumnGroup = {
  label: 'Win streak',
  columns: [
    lifetime('streak', 'Current', 'Current win streak', 0, (l) => l.currentStreak, { quietZero: true }),
    lifetime('bestStreak', 'Longest', 'Longest win streak', 0, (l) => l.longestStreak)
  ]
};

const FORM: ColumnGroup = {
  label: 'Form',
  columns: [
    {
      key: 'form',
      label: 'Last 10',
      title: 'Last 10 results, oldest to latest',
      digits: 0,
      value: () => null,
      strip: true
    }
  ]
};

const PLAYED: ColumnGroup = {
  label: 'Played',
  columns: [
    { key: 'days7', label: '7 d', title: 'Matches in the last 7 days', digits: 0, value: (p) => p.played.days7, quietZero: true },
    { key: 'days30', label: '30 d', title: 'Matches in the last 30 days', digits: 0, value: (p) => p.played.days30, quietZero: true },
    { key: 'days90', label: '90 d', title: 'Matches in the last 90 days', digits: 0, value: (p) => p.played.days90, quietZero: true },
    { key: 'last', label: 'Last', title: 'Last match', digits: 0, value: (p) => p.lastMatchAt, age: true }
  ]
};

const DUELS: ColumnGroup[] = [
  {
    label: 'Lifetime',
    columns: [lifetime('lifeMatches', 'M', 'Lifetime matches', 0, (l) => l.matches)]
  },
  {
    label: 'Entry',
    columns: [
      lifetime('entryRate', 'Rate %', 'Rounds with an opening duel', 0, (l) => l.entryRate),
      lifetime('entrySuccess', 'Success %', 'Opening duels won', 0, (l) => l.entrySuccess)
    ]
  },
  {
    label: 'Clutch',
    columns: [
      lifetime('clutch1v1', '1v1 %', '1v1 clutches won', 0, (l) => l.clutch1v1, {
        sample: (p) => p.lifetime?.clutch1v1Count ?? null
      }),
      lifetime('clutch1v1Count', 'n', '1v1 clutches played', 0, (l) => l.clutch1v1Count, { isSample: true }),
      lifetime('clutch1v2', '1v2 %', '1v2 clutches won', 0, (l) => l.clutch1v2, {
        sample: (p) => p.lifetime?.clutch1v2Count ?? null
      }),
      lifetime('clutch1v2Count', 'n', '1v2 clutches played', 0, (l) => l.clutch1v2Count, { isSample: true })
    ]
  },
  {
    label: 'Utility',
    columns: [
      lifetime('utility', 'Dmg/rd', 'Utility damage per round', 1, (l) => l.utilityDamagePerRound),
      lifetime('utilitySuccess', 'Success %', 'Utility that damaged or blinded an enemy', 0, (l) => l.utilitySuccess)
    ]
  },
  {
    label: 'Flash',
    columns: [
      lifetime('flashSuccess', 'Success %', 'Flashes that blinded an enemy', 0, (l) => l.flashSuccess),
      lifetime('flashes', 'Per rd', 'Flashes thrown per round', 2, (l) => l.flashesPerRound),
      lifetime('blinded', 'Enemies/rd', 'Enemies blinded per round', 2, (l) => l.enemiesFlashedPerRound)
    ]
  },
  {
    label: 'Sniper',
    columns: [lifetime('sniper', 'Kill %', 'Kills with a sniper rifle', 1, (l) => l.sniperKillShare)]
  }
];

/**
 * Column groups after ELO. Recent scopes add per-match figures and multi-kills; lifetime adds
 * win streaks. Duel and utility numbers only exist in FACEIT's lifetime record.
 */
export function columnGroups(view: View, scope: Scope): ColumnGroup[] {
  if (view === 'duels') return DUELS;
  const middle = scope === 'lifetime' ? [WIN_STREAK] : [PER_MATCH, MULTI_KILLS];
  return [RESULTS, FRAGGING, ...middle, FORM, PLAYED];
}

export const allColumns = (groups: ColumnGroup[]) => [ELO, ...groups.flatMap((group) => group.columns)];

export function formatValue(column: Column, value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return column.digits === 0 && Math.abs(value) >= 1000
    ? Math.round(value).toLocaleString('en-GB')
    : value.toFixed(column.digits);
}

/** Sorts players by a column; empty values always go last, ties fall back to ELO. */
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
    if (x === null && y === null) return b.elo - a.elo;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sign || b.elo - a.elo;
  });
}

export function sortByName(players: SquadPlayer[], direction: 'asc' | 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  return [...players].sort(
    (a, b) => a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' }) * sign
  );
}

/** Too few matches behind the numbers in view: the row is still shown, but muted. */
export function isLowSample(player: SquadPlayer, view: View, scope: Scope) {
  if (view === 'duels' || scope === 'lifetime') return (player.lifetime?.matches ?? 0) < 20;
  return (player.form[scope]?.matches ?? 0) < 10;
}

export const isActive = (player: SquadPlayer) => player.played.days90 > 0;
