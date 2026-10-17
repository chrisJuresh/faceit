import { env } from '$env/dynamic/private';
import {
  countSince,
  groupGames,
  mapForm,
  pairRecords,
  summarize,
  toLineup,
  toPlayerMatch,
  recentActivity,
  type HistoryMatch
} from '$lib/stats';
import type { LifetimeStats, MapStats, SquadOverview, SquadPlayer } from '$lib/types';
import { readAliases } from './aliases';
import {
  displayMap,
  normalizeFaceitUrl,
  optionalStat,
  round,
  safeImage,
  statNumber
} from './analytics';
import {
  getLifetimeStats,
  getPlayer,
  getPlayerByNickname,
  getPlayerGameStats,
  getRanking,
  mapWithConcurrency,
  type FaceitGameStatsItem,
  type FaceitLifetimeStats,
  type FaceitPlayer
} from './faceit';

const OWNER_NICKNAME = env.FACEIT_OWNER_NICKNAME || 'Christian976';
const DAY = 86_400;
/** Group numbers cover this many days, except the Maps Together row, which reads whole histories. */
export const WINDOW_DAYS = 90;
const PAGE_SIZE = 100;
/**
 * Up to 1,500 matches per player, enough for every lifetime in the group so far. A history that
 * runs past it is marked as read only so far back, and nothing older is claimed.
 */
const MAX_PAGES = 15;
const RECENT_MATCHES = 30;
const GROUP_GAMES = 40;
const ACTIVITY_DAYS = 14;
const ACTIVITY_WEEKS = 13;

type Stats = Record<string, string | number | null | string[]>;

const percent = (value: number | null) => (value === null ? null : round(value * 100, 1));

function parseScore(score: unknown, teamScore: number | null) {
  const parts = String(score ?? '')
    .split('/')
    .map((part) => Number.parseInt(part.trim(), 10));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return null;
  if (teamScore === null) return null;
  if (parts[0] === teamScore) return parts[1];
  if (parts[1] === teamScore) return parts[0];
  return null;
}

function timestamp(stats: Stats) {
  const finished = stats['Match Finished At'];
  if (typeof finished === 'number' && Number.isFinite(finished)) {
    return finished > 1e12 ? Math.floor(finished / 1000) : finished;
  }
  const created = Date.parse(String(stats['Created At'] ?? ''));
  return Number.isFinite(created) ? Math.floor(created / 1000) : 0;
}

/** Converts one FACEIT match-stats item. Non-5v5 modes (wingman, 1v1) are skipped. */
export function parsePlayerMatch(item: FaceitGameStatsItem): HistoryMatch | null {
  const stats = item.stats as Stats;
  const mode = String(stats['Game Mode'] ?? '5v5');
  const matchId = String(stats['Match Id'] ?? '');
  if (mode !== '5v5' || !matchId) return null;

  const teamScore = optionalStat(stats, 'Final Score');
  const rounds = statNumber(stats, 'Rounds');
  const damage = statNumber(stats, 'Damage');

  return {
    matchId,
    mapNumber: statNumber(stats, 'Match Round') || 1,
    finishedAt: timestamp(stats),
    map: displayMap(String(stats.Map ?? '')),
    won: String(stats.Result) === '1',
    teamScore,
    enemyScore: parseScore(stats.Score, teamScore),
    team: String(stats.Team ?? ''),
    rounds,
    kills: statNumber(stats, 'Kills'),
    deaths: statNumber(stats, 'Deaths'),
    assists: statNumber(stats, 'Assists'),
    headshots: statNumber(stats, 'Headshots'),
    damage,
    adr: statNumber(stats, 'ADR') || (rounds ? round(damage / rounds) : 0),
    mvps: statNumber(stats, 'MVPs'),
    doubleKills: statNumber(stats, 'Double Kills'),
    tripleKills: statNumber(stats, 'Triple Kills'),
    quadroKills: statNumber(stats, 'Quadro Kills'),
    pentaKills: statNumber(stats, 'Penta Kills')
  };
}

const mapSegments = (stats: FaceitLifetimeStats | null) =>
  (stats?.segments || []).filter(
    (segment) => (segment.type || 'Map') === 'Map' && (segment.mode || '5v5') === '5v5'
  );

export function parseMaps(stats: FaceitLifetimeStats | null): MapStats[] {
  return mapSegments(stats)
    .map((segment) => {
      const s = segment.stats as Stats;
      const matches = statNumber(s, 'Matches');
      return {
        map: displayMap(segment.label),
        image: safeImage(segment.img_regular || segment.img_small),
        matches,
        wins: statNumber(s, 'Wins'),
        winRate: statNumber(s, 'Win Rate %'),
        kd: statNumber(s, 'Average K/D Ratio'),
        kr: statNumber(s, 'Average K/R Ratio'),
        adr: statNumber(s, 'ADR'),
        headshots: statNumber(s, 'Average Headshots %'),
        kills: statNumber(s, 'Kills'),
        deaths: statNumber(s, 'Deaths'),
        rounds: statNumber(s, 'Rounds'),
        assists: statNumber(s, 'Assists'),
        mvps: statNumber(s, 'MVPs'),
        tripleKills: statNumber(s, 'Triple Kills'),
        quadroKills: statNumber(s, 'Quadro Kills'),
        pentaKills: statNumber(s, 'Penta Kills'),
        entrySuccess: percent(optionalStat(s, 'Entry Success Rate')),
        clutch1v1: percent(optionalStat(s, '1v1 Win Rate')),
        utilityDamagePerRound: optionalStat(s, 'Utility Damage per Round')
      };
    })
    .filter((map) => map.matches > 0)
    .sort((a, b) => b.matches - a.matches);
}

export function parseLifetime(stats: FaceitLifetimeStats | null, maps: MapStats[]): LifetimeStats | null {
  const life = stats?.lifetime as Stats | undefined;
  if (!life || !statNumber(life, 'Matches')) return null;

  // FACEIT's lifetime "K/D Ratio" and "Total Headshots %" are running sums, so use the
  // averaged fields, and derive K/R and per-match figures from the 5v5 map totals.
  const total = (pick: (map: MapStats) => number) => maps.reduce((sum, map) => sum + pick(map), 0);
  const mapMatches = total((map) => map.matches);
  const mapRounds = total((map) => map.rounds);
  const mapKills = total((map) => map.kills);
  const perMatch = (value: number) => (mapMatches ? round(value / mapMatches, 1) : null);
  const ifMaps = (value: number) => (mapMatches ? value : null);
  const extendedKills = statNumber(life, 'Total Kills with extended stats');
  const sniperKills = optionalStat(life, 'Total Sniper Kills');
  const recent = Array.isArray(life['Recent Results']) ? life['Recent Results'] : [];

  return {
    matches: statNumber(life, 'Matches'),
    wins: statNumber(life, 'Wins'),
    winRate: statNumber(life, 'Win Rate %'),
    kd: statNumber(life, 'Average K/D Ratio'),
    kr: mapRounds ? round(mapKills / mapRounds, 2) : null,
    adr: round(statNumber(life, 'ADR')),
    headshots: statNumber(life, 'Average Headshots %'),
    currentStreak: statNumber(life, 'Current Win Streak'),
    longestStreak: statNumber(life, 'Longest Win Streak'),
    recentResults: recent.map((result) => (String(result) === '1' ? 'W' : 'L')),
    entryRate: percent(optionalStat(life, 'Entry Rate')),
    entrySuccess: percent(optionalStat(life, 'Entry Success Rate')),
    clutch1v1: percent(optionalStat(life, '1v1 Win Rate')),
    clutch1v1Count: statNumber(life, 'Total 1v1 Count'),
    clutch1v2: percent(optionalStat(life, '1v2 Win Rate')),
    clutch1v2Count: statNumber(life, 'Total 1v2 Count'),
    utilityDamagePerRound: optionalStat(life, 'Utility Damage per Round'),
    utilitySuccess: percent(optionalStat(life, 'Utility Success Rate')),
    flashSuccess: percent(optionalStat(life, 'Flash Success Rate')),
    flashesPerRound: optionalStat(life, 'Flashes per Round'),
    enemiesFlashedPerRound: optionalStat(life, 'Enemies Flashed per Round'),
    sniperKillShare:
      sniperKills !== null && extendedKills ? round((sniperKills / extendedKills) * 100, 1) : null,
    avgKills: perMatch(mapKills),
    avgAssists: perMatch(total((map) => map.assists)),
    mvpsPerMatch: perMatch(total((map) => map.mvps)),
    tripleKills: ifMaps(total((map) => map.tripleKills)),
    quadroKills: ifMaps(total((map) => map.quadroKills)),
    pentaKills: ifMaps(total((map) => map.pentaKills))
  };
}

/**
 * A player's match history, newest first. Each older page asks for matches up to the oldest one
 * seen so far, since FACEIT refuses offsets past 200. `readFrom` is how far back the history is
 * complete: null when it was read to the start, otherwise the oldest time read, because the page
 * cap was hit, an older page failed, or `want` 5v5 matches were already in.
 */
export async function matchHistory(playerId: string, want = Infinity) {
  const matches: HistoryMatch[] = [];
  const seen = new Set<string>();
  let readFrom: number | null = null;
  let before: number | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const request = getPlayerGameStats(playerId, 0, PAGE_SIZE, before);
    // A failed older page shouldn't throw away the newer matches already parsed.
    const response = page === 0 ? await request : await request.catch(() => null);
    if (!response) {
      readFrom = before === undefined ? null : Math.ceil(before / 1000);
      break;
    }
    const items = response.items || [];
    const known = seen.size;
    for (const item of items) {
      // Keyed before parsing, so a page of only wingman still counts as new and paging goes on.
      const stats = item.stats as Stats;
      const key = `${stats['Match Id']}:${stats['Match Round']}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const match = parsePlayerMatch(item);
      if (match) matches.push(match);
    }

    // A page with nothing new is the end.
    if (items.length < PAGE_SIZE || seen.size === known) break;
    const oldestStats = items[items.length - 1].stats as Stats;
    const oldest = timestamp(oldestStats);
    if (page === MAX_PAGES - 1 || matches.length >= want) {
      readFrom = oldest;
      break;
    }
    // `to` leaves out a match finishing at exactly that millisecond, so step one past the oldest
    // and let the boundary match come back as a duplicate.
    const finished = oldestStats['Match Finished At'];
    before = (typeof finished === 'number' && finished > 1e12 ? finished : oldest * 1000) + 1;
  }

  return { matches: matches.sort((a, b) => b.finishedAt - a.finishedAt), readFrom };
}

async function buildPlayer(
  profile: FaceitPlayer,
  ownerId: string,
  alias: string | undefined,
  now: number
): Promise<{ player: SquadPlayer; matches: HistoryMatch[]; readFrom: number | null }> {
  const game = profile.games?.cs2;
  const region = game?.region || '';
  const country = (profile.country || '').toLowerCase();

  const [lifetimeStats, { matches, readFrom }] = await Promise.all([
    getLifetimeStats(profile.player_id).catch(() => null),
    // Nothing read: every count from these matches is unknown rather than zero.
    matchHistory(profile.player_id).catch(() => ({ matches: [] as HistoryMatch[], readFrom: now as number | null }))
  ]);
  /** Matches since `start`, or null when the matches read don't reach back that far. */
  const since = (start: number) => (readFrom !== null && readFrom > start ? null : countSince(matches, start));

  // FACEIT leaves players who stopped playing out of its ladders, so only ask for active ones.
  const ranked = Boolean(region) && (matches[0]?.finishedAt ?? 0) >= now - WINDOW_DAYS * DAY;
  const [regionRank, countryRank] = await Promise.all([
    ranked ? getRanking(region, profile.player_id).catch(() => null) : null,
    ranked && country ? getRanking(region, profile.player_id, country).catch(() => null) : null
  ]);

  const maps = parseMaps(lifetimeStats);
  const activated = Date.parse(profile.activated_at || '');

  const player: SquadPlayer = {
    playerId: profile.player_id,
    nickname: profile.nickname,
    displayName: alias || profile.nickname,
    alias: alias || null,
    isOwner: profile.player_id === ownerId,
    avatar: profile.avatar || '',
    country: country.toUpperCase(),
    faceitUrl: normalizeFaceitUrl(
      profile.faceit_url,
      `https://www.faceit.com/en/players/${encodeURIComponent(profile.nickname)}`
    ),
    steamUrl: /^\d{17}$/.test(profile.steam_id_64 || '')
      ? `https://steamcommunity.com/profiles/${profile.steam_id_64}`
      : '',
    steamName: profile.steam_nickname || '',
    verified: Boolean(profile.verified),
    memberSince: Number.isFinite(activated) ? Math.floor(activated / 1000) : null,
    region,
    elo: game?.faceit_elo || 0,
    level: game?.skill_level || 0,
    regionRank: regionRank?.position || null,
    countryRank: countryRank?.position || null,
    lifetime: parseLifetime(lifetimeStats, maps),
    maps,
    recent: matches.slice(0, RECENT_MATCHES).map(toPlayerMatch),
    form: {
      last10: summarize(matches.slice(0, 10)),
      last30: summarize(matches.slice(0, 30)),
      last100: summarize(matches.slice(0, 100))
    },
    mapForm: {
      last30: mapForm(matches.slice(0, 30)),
      last90: mapForm(matches.slice(0, 90))
    },
    played: {
      days7: since(now - 7 * DAY),
      days30: since(now - 30 * DAY),
      days90: since(now - 90 * DAY)
    },
    lastMatchAt: matches[0]?.finishedAt || null
  };

  return { player, matches, readFrom };
}

/** The owner and every friend with a CS2 profile. */
export async function squadProfiles() {
  const owner = await getPlayerByNickname(OWNER_NICKNAME);
  const friendIds = [...new Set(owner.friends_ids || [])].filter((id) => id !== owner.player_id);
  const friends = await mapWithConcurrency(friendIds, 6, (id) => getPlayer(id).catch(() => null));
  const profiles = [owner, ...friends].filter(
    (profile): profile is FaceitPlayer => profile !== null && Boolean(profile.games?.cs2)
  );
  return { owner, profiles };
}

export async function buildSquad(): Promise<SquadOverview> {
  const now = Math.floor(Date.now() / 1000);
  const [{ owner, profiles }, aliases] = await Promise.all([squadProfiles(), readAliases()]);

  const built = await mapWithConcurrency(profiles, 4, (profile) =>
    buildPlayer(profile, owner.player_id, aliases[profile.player_id], now)
  );

  const histories = built.map(({ player, matches, readFrom }) => ({ playerId: player.playerId, matches, readFrom }));
  // A history cut short (page cap or a failed older page) misses that player's older games, and a
  // group game needs two of the group's lines. So group numbers only reach back as far as every
  // history does: the 90-day window shrinks and says so, and so does the Together record. A read
  // that failed outright (readFrom = now) can't shrink them to nothing; that player shows unknown.
  const reached = built
    .map(({ readFrom }) => readFrom)
    .filter((readFrom): readFrom is number => readFrom !== null && readFrom < now);
  const togetherFrom = reached.length ? Math.max(...reached) : null;
  const windowStart = Math.max(now - WINDOW_DAYS * DAY, togetherFrom ?? 0);
  const windowDays = Math.floor((now - windowStart) / DAY);
  const everGames = groupGames(histories).filter((game) => togetherFrom === null || game.finishedAt >= togetherFrom);
  const games = everGames.filter((game) => game.finishedAt >= windowStart);

  const mapImages: Record<string, string> = {};
  for (const { player } of built) {
    for (const map of player.maps) {
      if (map.image && !mapImages[map.map]) mapImages[map.map] = map.image;
    }
  }

  return {
    ownerId: owner.player_id,
    generatedAt: now,
    windowDays,
    players: built.map(({ player }) => player).sort((a, b) => b.elo - a.elo),
    mapImages,
    games: games.slice(0, GROUP_GAMES),
    lineups: everGames.map(toLineup),
    togetherFrom,
    together: { matches: games.length, wins: games.filter((game) => game.won).length },
    pairs: pairRecords(games),
    activity: recentActivity(histories, ACTIVITY_DAYS, ACTIVITY_WEEKS, now)
  };
}
