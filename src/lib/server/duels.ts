import { summarizeDuels, type HistoryMatch } from '$lib/stats';
import type { DuelLine, DuelSummary, RecentDuels, RecentScope } from '$lib/types';
import { optionalStat, statNumber } from './analytics';
import { fetchMatchStats, mapWithConcurrency, type FaceitMatchStats } from './faceit';
import { kvConfigured, redis } from './kv';
import { matchHistory, squadProfiles } from './squad';

/** Each map of one match, with every player's duel line on it by player id. */
export type MatchDuels = Array<{ mapNumber: number; lines: Record<string, DuelLine> }>;

const SCOPES: Array<[RecentScope, number]> = [
  ['last10', 10],
  ['last30', 30],
  ['last100', 100]
];
const LATEST = 100;
/** Leaves room inside the route's 30 seconds on Vercel; whatever is left is read on the next request. */
const BUDGET_MS = 20_000;
/** Few enough that other FACEIT requests still get a turn at the shared rate limit. */
const CONCURRENCY = 6;
const REDIS_PREFIX = 'stackline:match-duels:v1:';
const REDIS_BATCH = 100;

/**
 * Finished matches don't change, so each is read from FACEIT once and kept for good: here for the
 * life of the process, and in Redis, when it is configured, for every instance after it.
 */
const store = new Map<string, MatchDuels>();
const reading = new Map<string, Promise<void>>();

/** A match's duel lines. A player FACEIT returned no duel stats for is left out. */
export function parseMatchDuels(stats: FaceitMatchStats): MatchDuels {
  return (stats.rounds || []).map((round, index) => {
    const rounds = statNumber(round.round_stats, 'Rounds');
    const lines: Record<string, DuelLine> = {};
    for (const team of round.teams || []) {
      for (const { player_id, player_stats: s } of team.players || []) {
        if (optionalStat(s, 'Entry Count') === null) continue;
        lines[player_id] = {
          rounds,
          kills: statNumber(s, 'Kills'),
          entryCount: statNumber(s, 'Entry Count'),
          entryWins: statNumber(s, 'Entry Wins'),
          clutch1v1Count: statNumber(s, '1v1Count'),
          clutch1v1Wins: statNumber(s, '1v1Wins'),
          clutch1v2Count: statNumber(s, '1v2Count'),
          clutch1v2Wins: statNumber(s, '1v2Wins'),
          utilityCount: statNumber(s, 'Utility Count'),
          utilitySuccesses: statNumber(s, 'Utility Successes'),
          utilityDamage: statNumber(s, 'Utility Damage'),
          flashCount: statNumber(s, 'Flash Count'),
          flashSuccesses: statNumber(s, 'Flash Successes'),
          enemiesFlashed: statNumber(s, 'Enemies Flashed'),
          sniperKills: statNumber(s, 'Sniper Kills')
        };
      }
    }
    return { mapNumber: Number(round.match_round) || index + 1, lines };
  });
}

/**
 * A player's summaries over their latest 10, 30 and 100 matches (newest first). One is null when
 * any of its matches has no line, or when the history stopped short of that many without `whole`,
 * reaching the player's first match.
 */
export function recentSummaries(
  matches: Array<Pick<HistoryMatch, 'matchId' | 'mapNumber'>>,
  whole: boolean,
  lineFor: (match: Pick<HistoryMatch, 'matchId' | 'mapNumber'>) => DuelLine | undefined
): Record<RecentScope, DuelSummary | null> {
  const lines = matches.slice(0, LATEST).map(lineFor);
  const summaries = SCOPES.map(([scope, count]) => {
    const run = lines.slice(0, count);
    const known = (matches.length >= count || whole) && run.every((line) => line !== undefined);
    return [scope, known ? summarizeDuels(run as DuelLine[]) : null];
  });
  return Object.fromEntries(summaries) as Record<RecentScope, DuelSummary | null>;
}

async function loadSaved(matchIds: string[]) {
  const missing = matchIds.filter((id) => !store.has(id));
  for (let start = 0; start < missing.length; start += REDIS_BATCH) {
    const batch = missing.slice(start, start + REDIS_BATCH);
    const values = await redis<Array<string | null>>('MGET', ...batch.map((id) => REDIS_PREFIX + id));
    values.forEach((value, index) => {
      if (typeof value !== 'string') return;
      try {
        store.set(batch[index], JSON.parse(value) as MatchDuels);
      } catch {
        // Read it from FACEIT again instead.
      }
    });
  }
}

/** Reads one match, sharing a read already under way. A failed read is tried again next time. */
function read(matchId: string) {
  let pending = reading.get(matchId);
  if (!pending) {
    pending = fetchMatchStats(matchId)
      .then(async (stats) => {
        const duels = parseMatchDuels(stats);
        if (!duels.length) return;
        store.set(matchId, duels);
        if (kvConfigured()) {
          await redis('SET', REDIS_PREFIX + matchId, JSON.stringify(duels)).catch((error) =>
            console.error('Match duels not saved', error)
          );
        }
      })
      .catch(() => undefined)
      .finally(() => reading.delete(matchId));
    reading.set(matchId, pending);
  }
  return pending;
}

/** Reads `matchIds` in order until the deadline. True when every one was tried in time. */
async function readUntil(matchIds: string[], deadline: number) {
  let next = 0;
  const worker = async () => {
    while (next < matchIds.length && Date.now() < deadline) await read(matchIds[next++]);
  };
  const all = Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => next >= matchIds.length);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), Math.max(0, deadline - Date.now()));
  });
  try {
    return await Promise.race([all, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Duel and utility summaries over each player's latest matches, from FACEIT's match-room stats:
 * the per-match pages behind the other recent numbers don't carry them. A cold read can take
 * longer than one request, so this reads what it can in time and says whether it finished.
 */
export async function buildRecentDuels(): Promise<RecentDuels> {
  const deadline = Date.now() + BUDGET_MS;
  const { profiles } = await squadProfiles();
  const histories = await mapWithConcurrency(profiles, 4, (profile) =>
    matchHistory(profile.player_id, LATEST)
      .then(({ matches, readFrom }) => ({ playerId: profile.player_id, matches, whole: readFrom === null }))
      // Nothing read: every summary for this player is unknown.
      .catch(() => ({ playerId: profile.player_id, matches: [] as HistoryMatch[], whole: false }))
  );

  // Everyone's latest match first, then everyone's second, so the last 10 fill in before the last 100.
  const rank = new Map<string, number>();
  for (const { matches } of histories) {
    matches.slice(0, LATEST).forEach((match, index) => {
      rank.set(match.matchId, Math.min(index, rank.get(match.matchId) ?? index));
    });
  }
  const matchIds = [...rank].sort((a, b) => a[1] - b[1]).map(([matchId]) => matchId);

  if (kvConfigured()) {
    await loadSaved(matchIds).catch((error) => console.error('Saved match duels unavailable', error));
  }
  const complete = await readUntil(
    matchIds.filter((matchId) => !store.has(matchId)),
    deadline
  );

  const lineFor = (playerId: string) => (match: Pick<HistoryMatch, 'matchId' | 'mapNumber'>) =>
    store.get(match.matchId)?.find((map) => map.mapNumber === match.mapNumber)?.lines[playerId];

  return {
    generatedAt: Math.floor(Date.now() / 1000),
    complete,
    total: matchIds.length,
    read: matchIds.filter((matchId) => store.has(matchId)).length,
    players: Object.fromEntries(
      histories.map(({ playerId, matches, whole }) => [playerId, recentSummaries(matches, whole, lineFor(playerId))])
    )
  };
}
