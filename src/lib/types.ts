export type DiscoverySource = 'recent-friends' | 'recent-teammates';
export type SwingSource = 'faceit' | 'estimated';

export interface MatchPerformance {
  matchId: string;
  playedAt: number;
  map: string;
  result: 'W' | 'L';
  score: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  kd: number;
  headshots: number;
  swing: number;
  faceitUrl: string;
}

export interface MapPerformance {
  map: string;
  matches: number;
  wins: number;
  winRate: number;
  swing: number;
  adr: number;
  kd: number;
}

export interface SquadPlayer {
  playerId: string;
  nickname: string;
  displayName: string;
  alias: string | null;
  avatar: string;
  country: string;
  faceitUrl: string;
  verified: boolean;
  elo: number;
  skillLevel: number;
  matches: number;
  statsMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  swing: number;
  swingSource: SwingSource;
  adr: number;
  kd: number;
  kr: number;
  headshots: number;
  assistsPerMatch: number;
  entrySuccess: number | null;
  currentForm: Array<'W' | 'L'>;
  trend: number[];
  lastPlayedAt: number;
  bestMap: MapPerformance | null;
  maps: MapPerformance[];
  recentMatches: MatchPerformance[];
}

export interface RecentMatch {
  matchId: string;
  playedAt: number;
  map: string;
  result: 'W' | 'L';
  score: string;
  teammateIds: string[];
  faceitUrl: string;
}

export interface MapSummary {
  map: string;
  matches: number;
  wins: number;
  winRate: number;
  ownerAdr: number;
}

export interface DashboardData {
  owner: {
    playerId: string;
    nickname: string;
    avatar: string;
    country: string;
    faceitUrl: string;
    elo: number;
    skillLevel: number;
    winRate: number;
    wins: number;
    losses: number;
    form: Array<'W' | 'L'>;
  };
  lookback: number;
  matchesAnalyzed: number;
  source: DiscoverySource;
  sourceLabel: string;
  generatedAt: number;
  swingSource: SwingSource;
  players: SquadPlayer[];
  recentMatches: RecentMatch[];
  maps: MapSummary[];
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
  swing: number;
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
  averageLevel: number;
  averageElo: number;
  rating: number;
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
  demoAvailable: boolean;
  trackedPlayerIds: string[];
  teams: LiveTeam[];
}

export interface SquadMemberStatus {
  playerId: string;
  nickname: string;
  displayName: string;
  avatar: string;
  skillLevel: number;
  elo: number;
  isOwner: boolean;
  lastMatchAt: number | null;
  activeMatchId: string | null;
}

export interface LiveOverview {
  owner: { playerId: string; nickname: string; avatar: string; faceitUrl: string };
  generatedAt: number;
  recentWindowMinutes: number;
  webhookEnabled: boolean;
  matches: LiveMatch[];
  squad: SquadMemberStatus[];
}
