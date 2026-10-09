// Record of matches announced by FACEIT webhooks. The public Data API has no
// "current match for player" endpoint, so webhooks are the only supported way to learn about
// a match before it shows up in player history. State lives in Redis when configured (needed
// on serverless hosts) and in memory otherwise.

import { hashToObject, kvConfigured, redis } from './kv';

export interface WebhookMatchEvent {
  matchId: string;
  event: string;
  playerIds: string[];
  receivedAt: number;
}

const TERMINAL_EVENTS = new Set([
  'match_status_finished',
  'match_status_cancelled',
  'match_status_aborted'
]);
const TERMINAL_RETENTION_MS = 60 * 60_000;
const MAX_RETENTION_MS = 3 * 60 * 60_000;
const MAX_ENTRIES = 200;
const MATCH_ID = /^[\w-]{8,80}$/;
const REDIS_KEY = 'stackline:webhook-matches';

const memory = new Map<string, WebhookMatchEvent>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseWebhookEvent(body: unknown, now = Date.now()): WebhookMatchEvent | null {
  if (!isRecord(body) || typeof body.event !== 'string' || !isRecord(body.payload)) return null;
  if (!body.event.startsWith('match_')) return null;

  const matchId = body.payload.id;
  if (typeof matchId !== 'string' || !MATCH_ID.test(matchId)) return null;

  const teams = Array.isArray(body.payload.teams) ? body.payload.teams : [];
  const playerIds = teams
    .flatMap((team) => (isRecord(team) && Array.isArray(team.roster) ? team.roster : []))
    .map((player) => (isRecord(player) ? player.id : null))
    .filter((id): id is string => typeof id === 'string' && MATCH_ID.test(id));

  return { matchId, event: body.event, playerIds, receivedAt: now };
}

export function isExpired(entry: WebhookMatchEvent, now: number) {
  const age = now - entry.receivedAt;
  return age > MAX_RETENTION_MS || (TERMINAL_EVENTS.has(entry.event) && age > TERMINAL_RETENTION_MS);
}

/** Splits entries into those to keep (newest first, capped) and the match IDs to drop. */
export function partitionEntries(entries: WebhookMatchEvent[], now: number) {
  const live = entries
    .filter((entry) => !isExpired(entry, now))
    .sort((a, b) => b.receivedAt - a.receivedAt);
  const keep = live.slice(0, MAX_ENTRIES);
  const keepIds = new Set(keep.map((entry) => entry.matchId));
  return { keep, drop: entries.filter((entry) => !keepIds.has(entry.matchId)).map((e) => e.matchId) };
}

function parseStored(value: string): WebhookMatchEvent | null {
  try {
    const parsed = JSON.parse(value) as WebhookMatchEvent;
    return typeof parsed?.matchId === 'string' && typeof parsed.receivedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

async function readAll(): Promise<WebhookMatchEvent[]> {
  if (!kvConfigured()) return [...memory.values()];
  const stored = hashToObject(await redis('HGETALL', REDIS_KEY));
  return Object.values(stored)
    .map(parseStored)
    .filter((entry): entry is WebhookMatchEvent => entry !== null);
}

async function prune(now: number) {
  const entries = await readAll();
  const { keep, drop } = partitionEntries(entries, now);
  if (!drop.length) return keep;
  if (kvConfigured()) await redis('HDEL', REDIS_KEY, ...drop);
  else drop.forEach((matchId) => memory.delete(matchId));
  return keep;
}

export async function recordWebhookEvent(body: unknown, now = Date.now()) {
  const event = parseWebhookEvent(body, now);
  if (!event) return null;

  // Later events (e.g. finished) can omit the roster, so keep the one we already have.
  if (kvConfigured()) {
    const previousRaw = await redis<string | null>('HGET', REDIS_KEY, event.matchId);
    const previous = previousRaw ? parseStored(previousRaw) : null;
    const entry = { ...event, playerIds: event.playerIds.length ? event.playerIds : previous?.playerIds || [] };
    await redis('HSET', REDIS_KEY, event.matchId, JSON.stringify(entry));
    await redis('EXPIRE', REDIS_KEY, Math.ceil(MAX_RETENTION_MS / 1000));
  } else {
    const previous = memory.get(event.matchId);
    memory.set(event.matchId, {
      ...event,
      playerIds: event.playerIds.length ? event.playerIds : previous?.playerIds || []
    });
  }

  await prune(now);
  return event;
}

export async function webhookMatches(now = Date.now()) {
  return prune(now);
}

export function clearWebhookMatches() {
  memory.clear();
}
