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
