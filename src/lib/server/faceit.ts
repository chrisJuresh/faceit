import { env } from '$env/dynamic/private';
import { cached } from './cache';

const BASE_URL = 'https://open.faceit.com/data/v4';

export interface FaceitRosterPlayer {
  player_id: string;
  nickname: string;
  avatar?: string;
  skill_level?: number;
  faceit_url?: string;
}

export interface FaceitHistoryMatch {
  match_id: string;
  finished_at: number;
  status: string;
  teams: Record<
    string,
    {
      team_id: string;
      nickname: string;
      players: FaceitRosterPlayer[];
    }
  >;
  results: {
    winner: string;
    score: Record<string, number>;
  };
  faceit_url?: string;
}

export interface FaceitPlayer {
  player_id: string;
  nickname: string;
  avatar?: string;
  country?: string;
  faceit_url?: string;
  verified?: boolean;
  friends_ids?: string[];
  steam_id_64?: string;
  steam_nickname?: string;
  activated_at?: string;
  games?: Record<
    string,
    {
      faceit_elo?: number;
      skill_level?: number;
      region?: string;
    }
  >;
}

/** One item from /players/{id}/games/cs2/stats. Values are strings except timestamps. */
export interface FaceitGameStatsItem {
  stats: Record<string, string | number | null>;
}

export interface FaceitRanking {
  position?: number;
}

export interface FaceitStatsPlayer {
  player_id: string;
  nickname: string;
  player_stats: Record<string, string | number | null>;
}

export interface FaceitStatsTeam {
  team_id: string;
  premade?: boolean;
  team_stats: Record<string, string | number | null>;
  players: FaceitStatsPlayer[];
}

export interface FaceitStatsRound {
  match_id: string;
  /** Map number inside a best-of series, like "Match Round" in a player's match stats. */
  match_round?: string | number;
  round_stats: Record<string, string | number | null>;
  teams: FaceitStatsTeam[];
}

export interface FaceitMatchStats {
  rounds: FaceitStatsRound[];
}

export interface FaceitMatchRosterPlayer {
  player_id: string;
  nickname: string;
  avatar?: string;
  membership?: string;
  game_player_id?: string;
  game_player_name?: string;
  game_skill_level?: number;
  anticheat_required?: boolean;
}

export interface FaceitMatchFaction {
  faction_id: string;
  leader?: string;
  avatar?: string;
  name: string;
  type?: string;
  substituted?: boolean;
  roster: FaceitMatchRosterPlayer[];
  stats?: {
    winProbability?: number;
    skillLevel?: { average?: number; range?: { min?: number; max?: number } };
    rating?: number;
  };
}

export interface FaceitVotingEntity {
  name?: string;
  class_name?: string;
  game_map_id?: string;
  guid?: string;
  image_lg?: string;
  image_sm?: string;
}

export interface FaceitMatch {
  match_id: string;
  game?: string;
  region?: string;
  status: string;
  competition_id?: string;
  competition_type?: string;
  competition_name?: string;
  best_of?: number;
  calculate_elo?: boolean;
  configured_at?: number;
  started_at?: number;
  finished_at?: number;
  faceit_url?: string;
  /** Private resource URLs, not downloads: only FACEIT's separately approved Downloads API signs them. */
  demo_url?: string[];
  teams: Record<string, FaceitMatchFaction>;
  voting?: Record<string, { entities?: FaceitVotingEntity[]; pick?: string[] } | string[] | undefined>;
  results?: { winner?: string; score?: Record<string, number> };
  detailed_results?: Array<{
    asc_score?: boolean;
    winner?: string;
    factions?: Record<string, { score?: number }>;
  }>;
}

export interface FaceitLifetimeStats {
  player_id: string;
  lifetime: Record<string, string | number | string[] | null>;
  segments?: Array<{
    label: string;
    mode?: string;
    type?: string;
    img_small?: string;
    img_regular?: string;
    stats: Record<string, string | number | null>;
  }>;
}

export class FaceitApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message);
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// FACEIT allows 20 requests per second per key; stay just under it so a cold load of the
// whole friends list queues instead of failing with 429s.
const REQUESTS_PER_WINDOW = 18;
const WINDOW_MS = 1000;
const recentStarts: number[] = [];
let gate: Promise<void> = Promise.resolve();

function throttle() {
  const turn = gate.then(async () => {
    for (;;) {
      const now = Date.now();
      while (recentStarts.length && now - recentStarts[0] >= WINDOW_MS) recentStarts.shift();
      if (recentStarts.length < REQUESTS_PER_WINDOW) {
        recentStarts.push(now);
        return;
      }
      await pause(WINDOW_MS - (now - recentStarts[0]) + 5);
    }
  });
  gate = turn;
  return turn;
}

function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get('retry-after') ?? response.headers.get('ratelimit-reset');
  const seconds = header === null ? Number.NaN : Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 600 * 2 ** attempt;
}

async function request<T>(endpoint: string, attempt = 0): Promise<T> {
  const apiKey = env.API_KEY?.trim();
  if (!apiKey) throw new FaceitApiError('FACEIT API key is not configured.', 500, endpoint);

  await throttle();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 3) {
    await pause(retryDelay(response, attempt));
    return request<T>(endpoint, attempt + 1);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { message?: string };
      detail = body.message ?? '';
    } catch {
      // FACEIT occasionally returns an empty error body.
    }
    throw new FaceitApiError(detail || `FACEIT returned ${response.status}.`, response.status, endpoint);
  }

  return (await response.json()) as T;
}

const MINUTE = 60_000;

export function getPlayerByNickname(nickname: string) {
  const endpoint = `/players?nickname=${encodeURIComponent(nickname)}&game=cs2`;
  return cached(
    `player:nickname:${nickname.toLowerCase()}`,
    5 * MINUTE,
    () => request<FaceitPlayer>(endpoint),
    55 * MINUTE
  );
}

export function getPlayer(playerId: string) {
  return cached(
    `player:id:${playerId}`,
    5 * MINUTE,
    () => request<FaceitPlayer>(`/players/${encodeURIComponent(playerId)}`),
    55 * MINUTE
  );
}

export function getRecentHistory(playerId: string, limit: number) {
  return cached(`recent-history:${playerId}:${limit}`, 20_000, () =>
    request<{ items: FaceitHistoryMatch[] }>(
      `/players/${encodeURIComponent(playerId)}/history?game=cs2&offset=0&limit=${limit}`
    )
  );
}

/**
 * Up to 100 of a player's CS2 matches that finished at or before `to`, newest first. The history
 * endpoint caps its offset at 1000, so walking further back moves `to` instead.
 */
export function getHistoryUntil(playerId: string, to: number) {
  return cached(
    `history-until:${playerId}:${to}`,
    10 * MINUTE,
    () =>
      request<{ items: FaceitHistoryMatch[] }>(
        `/players/${encodeURIComponent(playerId)}/history?game=cs2&from=0&to=${to}&offset=0&limit=100`
      ),
    50 * MINUTE
  );
}

export function getMatch(matchId: string) {
  return cached(`match:${matchId}`, 10_000, () =>
    request<FaceitMatch>(`/matches/${encodeURIComponent(matchId)}`)
  );
}

export function getLifetimeStats(playerId: string) {
  return cached(
    `lifetime:${playerId}`,
    10 * MINUTE,
    () => request<FaceitLifetimeStats>(`/players/${encodeURIComponent(playerId)}/stats/cs2`),
    50 * MINUTE
  );
}

/**
 * A player's per-match stats, newest first, one page of up to 100. FACEIT refuses offsets past
 * 200, so older pages pass `to` (milliseconds) instead: matches up to that time.
 */
export function getPlayerGameStats(playerId: string, offset: number, limit: number, to?: number) {
  const boundedLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const until = to === undefined ? '' : `&to=${Math.floor(to)}`;
  return cached(
    `game-stats:${playerId}:${offset}:${boundedLimit}${until}`,
    2 * MINUTE,
    () =>
      request<{ items: FaceitGameStatsItem[] }>(
        `/players/${encodeURIComponent(playerId)}/games/cs2/stats?offset=${offset}&limit=${boundedLimit}${until}`
      ),
    28 * MINUTE
  );
}

/** A player's position in FACEIT's regional (or national) ladder; 0 when unranked. */
export function getRanking(region: string, playerId: string, country?: string) {
  const countryParam = country ? `&country=${encodeURIComponent(country.toLowerCase())}` : '';
  return cached(
    `rank:${region}:${country || '*'}:${playerId}`,
    15 * MINUTE,
    () =>
      request<FaceitRanking>(
        `/rankings/games/cs2/regions/${encodeURIComponent(region)}/players/${encodeURIComponent(playerId)}?limit=1${countryParam}`
      ),
    45 * MINUTE
  );
}

/** A match's stats, read straight from FACEIT, for callers that keep their own copy. */
export function fetchMatchStats(matchId: string) {
  return request<FaceitMatchStats>(`/matches/${encodeURIComponent(matchId)}/stats`);
}

export function getMatchStats(matchId: string) {
  // Only requested for finished matches, whose stats no longer change.
  return cached(`match-stats:${matchId}`, 6 * 60 * MINUTE, () => fetchMatchStats(matchId));
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}
