/** One finished 5v5 match from a player's FACEIT match-stats history. */
export interface PlayerMatch {
  matchId: string;
  finishedAt: number;
  map: string;
  won: boolean;
  /** Rounds won by this player's team, then rounds won by the other team. */
  teamScore: number | null;
  enemyScore: number | null;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  adr: number;
  mvps: number;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
}

/** One player's scoreline inside a group game. */
export interface GameLine {
  playerId: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  headshots: number;
  mvps: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
}

/** FACEIT's lifetime CS2 record for a player. Rates are percentages (0–100). */
export interface LifetimeStats {
  matches: number;
  wins: number;
  winRate: number;
  kd: number;
  kr: number | null;
  adr: number;
  headshots: number;
  currentStreak: number;
  longestStreak: number;
  recentResults: Array<'W' | 'L'>;
  entryRate: number | null;
  entrySuccess: number | null;
  clutch1v1: number | null;
  clutch1v1Count: number;
  clutch1v2: number | null;
  clutch1v2Count: number;
  utilityDamagePerRound: number | null;
  utilitySuccess: number | null;
  flashSuccess: number | null;
  flashesPerRound: number | null;
  enemiesFlashedPerRound: number | null;
  /** Share of kills made with a sniper rifle. */
  sniperKillShare: number | null;
  /** Per-match averages and multi-kill totals, summed over FACEIT's 5v5 map records. */
  avgKills: number | null;
  avgAssists: number | null;
  mvpsPerMatch: number | null;
  tripleKills: number | null;
  quadroKills: number | null;
  pentaKills: number | null;
}

/** FACEIT's lifetime record on one map (5v5 only). */
export interface MapStats {
  map: string;
  image: string;
  matches: number;
  wins: number;
  winRate: number;
  kd: number;
  kr: number;
  adr: number;
  headshots: number;
  kills: number;
  deaths: number;
  rounds: number;
  assists: number;
  mvps: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  entrySuccess: number | null;
  clutch1v1: number | null;
  utilityDamagePerRound: number | null;
}

/** Totals and rates over a run of a player's matches, counted from FACEIT's per-match stats. */
export interface Summary {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  kr: number;
  adr: number;
  /** Share of kills that were headshots. */
  headshots: number;
  avgKills: number;
  avgAssists: number;
  mvpsPerMatch: number;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
}

/** A player's record on one map over a run of their latest matches, counted like a Summary. */
export interface MapForm {
  map: string;
  matches: number;
  wins: number;
  winRate: number;
  kd: number;
  adr: number;
}

export interface SquadPlayer {
  playerId: string;
  nickname: string;
  displayName: string;
  alias: string | null;
  isOwner: boolean;
  avatar: string;
  country: string;
  faceitUrl: string;
  steamUrl: string;
  steamName: string;
  verified: boolean;
  memberSince: number | null;
  region: string;
  elo: number;
  level: number;
  regionRank: number | null;
  countryRank: number | null;
  lifetime: LifetimeStats | null;
  maps: MapStats[];
  /** Latest matches, newest first. */
  recent: PlayerMatch[];
  /** Summaries over the latest 10, 30 and 100 matches. */
  form: { last10: Summary | null; last30: Summary | null; last100: Summary | null };
  /** Per-map records over the latest 30 and 90 matches, most played first. */
  mapForm: { last30: MapForm[]; last90: MapForm[] };
  /** Matches played in the last 7, 30 and 90 days. */
  /** Null when the matches read don't reach back that far. */
  played: { days7: number | null; days30: number | null; days90: number | null };
  lastMatchAt: number | null;
}

export interface GroupGame {
  key: string;
  matchId: string;
  finishedAt: number;
  map: string;
  won: boolean;
  teamScore: number | null;
  enemyScore: number | null;
  rounds: number;
  /** The group's players in this match, most kills first. */
  lines: GameLine[];
}

/** A group game reduced to who played and how it went, enough to recount any subset of the group. */
export interface GroupLineup {
  map: string;
  won: boolean;
  lines: Array<{ playerId: string; kills: number; deaths: number }>;
}

/** The group's record on one map: games with two or more chosen players on the same team. */
export interface TogetherMap {
  map: string;
  matches: number;
  wins: number;
  /** Kills and deaths of the chosen players only. */
  kills: number;
  deaths: number;
}

export interface PairRecord {
  a: string;
  b: string;
  matches: number;
  wins: number;
  winRate: number;
}

export interface SquadOverview {
  ownerId: string;
  generatedAt: number;
  /** Group-level numbers (games together, pairs, activity) cover this many days. */
  windowDays: number;
  players: SquadPlayer[];
  mapImages: Record<string, string>;
  /** Latest matches where two or more of the group were on the same team. */
  games: GroupGame[];
  /** Every group game in the players' fetched histories, not just the window, newest first. */
  lineups: GroupLineup[];
  /**
   * Null when every history was read to its start, so lineups are every group game. Otherwise a
   * history was cut short and lineups only reach back to this time.
   */
  togetherFrom: number | null;
  together: { matches: number; wins: number };
  pairs: PairRecord[];
  /** Matches per player per day and per week (UTC), oldest first; null where not read. */
  activity: {
    dayStarts: number[];
    weekStarts: number[];
    rows: Array<{ playerId: string; days: Array<number | null>; weeks: Array<number | null> }>;
  };
}

/**
 * Matches per player per month and per year (UTC), oldest first, from each full CS2 history; null
 * where that history wasn't read.
 */
export interface LongActivity {
  generatedAt: number;
  monthStarts: number[];
  yearStarts: number[];
  rows: Array<{ playerId: string; months: Array<number | null>; years: Array<number | null> }>;
}

export type LivePhase = 'live' | 'setup' | 'finished' | 'cancelled';
export type LiveSource = 'history' | 'webhook' | 'lookup';

export interface LiveStatEntry {
  label: string;
  value: string;
}

export interface LiveLifetime {
  matches: number;
  winRate: number;
  kd: number;
  adr: number;
  headshots: number;
  entrySuccess: number;
  clutch1v1: number;
  currentStreak: number;
  longestStreak: number;
  recentResults: Array<'W' | 'L'>;
}

export interface LiveMapRecord {
  map: string;
  matches: number;
  winRate: number;
  kd: number;
  kr: number;
  adr: number;
  headshots: number;
}

export interface LiveScoreline {
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  kr: number;
  adr: number;
  headshots: number;
  mvps: number;
  firstKills: number;
  entryWins: number;
  entryCount: number;
  clutchWins: number;
  clutchAttempts: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  utilityDamage: number;
  enemiesFlashed: number;
  sniperKills: number;
}

export interface LivePlayer {
  playerId: string;
  nickname: string;
  displayName: string;
  avatar: string;
  country: string;
  faceitUrl: string;
  skillLevel: number;
  elo: number;
  membership: string;
  gamePlayerName: string;
  verified: boolean;
  isOwner: boolean;
  isFriend: boolean;
  isLeader: boolean;
  lifetime: LiveLifetime | null;
  onMap: LiveMapRecord | null;
  scoreline: LiveScoreline | null;
  allStats: LiveStatEntry[];
}

export interface LiveTeam {
  factionId: string;
  faction: string;
  name: string;
  avatar: string;
  winProbability: number | null;
  averageElo: number;
  score: number | null;
  firstHalf: number | null;
  secondHalf: number | null;
  overtime: number | null;
  won: boolean;
  tracked: boolean;
  players: LivePlayer[];
}

export interface LiveMatch {
  matchId: string;
  status: string;
  phase: LivePhase;
  source: LiveSource;
  competition: string;
  region: string;
  bestOf: number;
  calculateElo: boolean;
  map: { name: string; image: string } | null;
  location: { name: string; image: string } | null;
  configuredAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  rounds: number | null;
  faceitUrl: string;
  trackedPlayerIds: string[];
  teams: LiveTeam[];
}

export interface LiveOverview {
  generatedAt: number;
  recentWindowMinutes: number;
  webhookEnabled: boolean;
  matches: LiveMatch[];
}
