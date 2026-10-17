import { longActivity } from '$lib/stats';
import type { LongActivity } from '$lib/types';
import { cached } from './cache';
import { getHistoryUntil, mapWithConcurrency } from './faceit';
import { squadProfiles } from './squad';

const MINUTE = 60_000;
const PAGE_SIZE = 100;
/** Stops a very long history at 3,000 matches. */
const MAX_PAGES = 30;
const MONTHS = 12;

/**
 * When each of a player's CS2 matches finished, newest first, walking back page by page.
 * `readFrom` is null when the whole history was read, otherwise how far back it got: the page cap
 * was hit or a page failed. A first page that fails throws.
 */
async function matchTimes(playerId: string, now: number) {
  const seen = new Set<string>();
  const finishedAt: number[] = [];
  let readFrom: number | null = null;
  let to = now;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const request = getHistoryUntil(playerId, to);
    const response = page === 0 ? await request : await request.catch(() => null);
    if (!response) {
      readFrom = to;
      break;
    }
    const items = response.items || [];
    // `to` is inclusive, so each page repeats the last one's oldest match.
    let added = 0;
    for (const match of items) {
      if (seen.has(match.match_id)) continue;
      seen.add(match.match_id);
      finishedAt.push(match.finished_at);
      added += 1;
    }
    if (items.length < PAGE_SIZE || !added) break;
    to = items[items.length - 1].finished_at;
    if (page === MAX_PAGES - 1) readFrom = to;
  }

  return { matches: finishedAt.map((time) => ({ finishedAt: time })), readFrom };
}

async function build(): Promise<LongActivity> {
  const now = Math.floor(Date.now() / 1000);
  const { profiles } = await squadProfiles();
  const players = await mapWithConcurrency(profiles, 4, async (profile) => ({
    playerId: profile.player_id,
    // Nothing read: every period is unknown rather than zero.
    ...(await matchTimes(profile.player_id, now).catch(() => ({ matches: [], readFrom: now })))
  }));
  return { generatedAt: now, ...longActivity(players, MONTHS, now) };
}

/** Matches per month and per year for the whole group. Old months don't change, so it keeps a while. */
export function buildLongActivity() {
  return cached('long-activity', 30 * MINUTE, build, 6 * 60 * MINUTE);
}
