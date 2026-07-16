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
  games?: Record<
    string,
    {
      faceit_elo?: number;
      skill_level?: number;
      region?: string;
    }
  >;
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
  round_stats: Record<string, string | number | null>;
  teams: FaceitStatsTeam[];
}

export interface FaceitMatchStats {
  rounds: FaceitStatsRound[];
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

async function request<T>(endpoint: string, attempt = 0): Promise<T> {
  const apiKey = env.API_KEY?.trim();
  if (!apiKey) throw new FaceitApiError('FACEIT API key is not configured.', 500, endpoint);

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 2) {
    const retryAfter = Number(response.headers.get('retry-after'));
    await pause(Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * 2 ** attempt);
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

export function getPlayerByNickname(nickname: string) {
  const endpoint = `/players?nickname=${encodeURIComponent(nickname)}&game=cs2`;
  return cached(`player:nickname:${nickname.toLowerCase()}`, 5 * 60_000, () =>
    request<FaceitPlayer>(endpoint)
  );
}

export function getPlayer(playerId: string) {
  return cached(`player:id:${playerId}`, 5 * 60_000, () =>
    request<FaceitPlayer>(`/players/${encodeURIComponent(playerId)}`)
  );
}

export function getPlayerHistory(playerId: string, limit: number) {
  const boundedLimit = Math.max(1, Math.min(100, Math.round(limit)));
  return cached(`history:${playerId}:${boundedLimit}`, 60_000, () =>
    request<{ items: FaceitHistoryMatch[]; start: number; end: number }>(
      `/players/${encodeURIComponent(playerId)}/history?game=cs2&offset=0&limit=${boundedLimit}`
    )
  );
}

export function getMatchStats(matchId: string) {
  return cached(`match-stats:${matchId}`, 30 * 60_000, () =>
    request<FaceitMatchStats>(`/matches/${encodeURIComponent(matchId)}/stats`)
  );
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
