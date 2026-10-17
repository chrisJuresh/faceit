import { env } from '$env/dynamic/private';
import {
  countSince,
  groupGames,
  mapRecords,
  pairRecords,
  summarize,
  toPlayerMatch,
  weeklyActivity,
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
/** Group numbers cover this many days; busy players get extra pages to reach back that far. */
export const WINDOW_DAYS = 90;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const RECENT_MATCHES = 30;
const GROUP_GAMES = 40;
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

/** Latest page of matches, plus older pages while they still fall inside the window. */
async function recentMatches(playerId: string, windowStart: number) {
  const matches: HistoryMatch[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const request = getPlayerGameStats(playerId, page * PAGE_SIZE, PAGE_SIZE);
    // A failed older page shouldn't throw away the newer matches already parsed.
    const response = page === 0 ? await request : await request.catch(() => null);
    if (!response) break;
    const items = response.items || [];
    for (const item of items) {
      const match = parsePlayerMatch(item);
      const key = match ? `${match.matchId}:${match.mapNumber}` : '';
      if (!match || seen.has(key)) continue;
      seen.add(key);
      matches.push(match);
    }

    const oldest = items.length ? timestamp(items[items.length - 1].stats as Stats) : 0;
    if (items.length < PAGE_SIZE || oldest < windowStart) break;
  }

  return matches.sort((a, b) => b.finishedAt - a.finishedAt);
}

async function buildPlayer(
  profile: FaceitPlayer,
  ownerId: string,
  alias: string | undefined,
  now: number
): Promise<{ player: SquadPlayer; matches: HistoryMatch[] }> {
  const game = profile.games?.cs2;
  const region = game?.region || '';
  const country = (profile.country || '').toLowerCase();

  const [lifetimeStats, matches] = await Promise.all([
    getLifetimeStats(profile.player_id).catch(() => null),
    recentMatches(profile.player_id, now - WINDOW_DAYS * DAY).catch(() => [] as HistoryMatch[])
  ]);

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
    played: {
      days7: countSince(matches, now - 7 * DAY),
      days30: countSince(matches, now - 30 * DAY),
      days90: countSince(matches, now - 90 * DAY)
    },
    lastMatchAt: matches[0]?.finishedAt || null
  };

  return { player, matches };
}

export async function buildSquad(): Promise<SquadOverview> {
  const owner = await getPlayerByNickname(OWNER_NICKNAME);
  const friendIds = [...new Set(owner.friends_ids || [])].filter((id) => id !== owner.player_id);
  const now = Math.floor(Date.now() / 1000);

  const [friends, aliases] = await Promise.all([
    mapWithConcurrency(friendIds, 6, (id) => getPlayer(id).catch(() => null)),
    readAliases()
  ]);

  const profiles = [owner, ...friends].filter(
    (profile): profile is FaceitPlayer => profile !== null && Boolean(profile.games?.cs2)
  );

  const built = await mapWithConcurrency(profiles, 4, (profile) =>
    buildPlayer(profile, owner.player_id, aliases[profile.player_id], now)
  );

  const histories = built.map(({ player, matches }) => ({ playerId: player.playerId, matches }));
  const windowStart = now - WINDOW_DAYS * DAY;
  const games = groupGames(histories).filter((game) => game.finishedAt >= windowStart);

  const mapImages: Record<string, string> = {};
  for (const { player } of built) {
    for (const map of player.maps) {
      if (map.image && !mapImages[map.map]) mapImages[map.map] = map.image;
    }
  }

  return {
    ownerId: owner.player_id,
    generatedAt: now,
    windowDays: WINDOW_DAYS,
    players: built.map(({ player }) => player).sort((a, b) => b.elo - a.elo),
    mapImages,
    games: games.slice(0, GROUP_GAMES),
    together: { matches: games.length, wins: games.filter((game) => game.won).length },
    pairs: pairRecords(games),
    groupMaps: mapRecords(games),
    activity: weeklyActivity(histories, ACTIVITY_WEEKS, now)
  };
}
