import { env } from '$env/dynamic/private';
import type {
  LiveLifetime,
  LiveMapRecord,
  LiveMatch,
  LiveOverview,
  LivePhase,
  LivePlayer,
  LiveScoreline,
  LiveSource,
  LiveTeam,
  SquadMemberStatus
} from '$lib/types';
import { readAliases } from './aliases';
import { estimatedSwing, round, statNumber } from './analytics';
import { displayMap, normalizeFaceitUrl } from './dashboard';
import {
  getLifetimeStats,
  getMatch,
  getMatchStats,
  getPlayer,
  getPlayerByNickname,
  getRecentHistory,
  mapWithConcurrency,
  type FaceitLifetimeStats,
  type FaceitMatch,
  type FaceitMatchStats,
  type FaceitPlayer,
  type FaceitVotingEntity
} from './faceit';
import { webhookMatches } from './live-registry';

const OWNER_NICKNAME = env.FACEIT_OWNER_NICKNAME || 'Christian976';
export const RECENT_WINDOW_MINUTES = 60;
const MAX_MATCHES = 6;
const MATCH_ID_PATTERN = /(?:\d-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type StatsRecord = Record<string, string | number | null | string[]>;

export interface MatchContext {
  ownerId: string;
  friendIds: Set<string>;
  source: LiveSource;
  profiles: Map<string, FaceitPlayer>;
  lifetimes: Map<string, FaceitLifetimeStats>;
  stats: FaceitMatchStats | null;
  aliases: Record<string, string>;
}

export function extractMatchId(value: string | null | undefined) {
  if (!value) return null;
  return value.match(MATCH_ID_PATTERN)?.[0].toLowerCase() ?? null;
}

export function matchPhase(status: string | undefined): LivePhase {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'FINISHED') return 'finished';
  if (normalized === 'CANCELLED' || normalized === 'ABORTED') return 'cancelled';
  if (normalized === 'ONGOING') return 'live';
  return 'setup';
}

// Image URLs end up inside an inline CSS url(), so only accept plain https URLs.
const safeImage = (value: string | undefined) =>
  value && /^https:\/\/[^\s'"()\\]+$/.test(value) ? value : '';

const normalizeMapKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/^de_|^cs_/, '')
    .replace(/[^a-z0-9]/g, '');

function votedEntity(match: FaceitMatch, type: string): FaceitVotingEntity | null {
  const vote = match.voting?.[type];
  if (!vote || Array.isArray(vote)) return null;
  const pick = vote.pick?.[0];
  if (!pick) return null;
  return (
    vote.entities?.find((entity) =>
      [entity.class_name, entity.guid, entity.game_map_id, entity.name].includes(pick)
    ) ?? { name: pick }
  );
}

function resultsList(value: StatsRecord[string]): Array<'W' | 'L'> {
  if (!Array.isArray(value)) return [];
  return value.map((result) => (String(result) === '1' ? 'W' : 'L'));
}

function lifetimeFor(stats: FaceitLifetimeStats | undefined): LiveLifetime | null {
  if (!stats?.lifetime) return null;
  const life = stats.lifetime as Record<string, string | number | null>;
  return {
    matches: statNumber(life, 'Matches', 'Total Matches'),
    winRate: statNumber(life, 'Win Rate %'),
    kd: statNumber(life, 'Average K/D Ratio', 'K/D Ratio'),
    adr: statNumber(life, 'ADR'),
    headshots: statNumber(life, 'Average Headshots %', 'Total Headshots %'),
    entrySuccess: round(statNumber(life, 'Entry Success Rate') * 100),
    clutch1v1: round(statNumber(life, '1v1 Win Rate') * 100),
    currentStreak: statNumber(life, 'Current Win Streak'),
    longestStreak: statNumber(life, 'Longest Win Streak'),
    recentResults: resultsList(stats.lifetime['Recent Results'])
  };
}

function mapRecordFor(stats: FaceitLifetimeStats | undefined, map: string | null): LiveMapRecord | null {
  if (!stats?.segments || !map) return null;
  const key = normalizeMapKey(map);
  const segment = stats.segments.find(
    (entry) => (entry.type || 'Map') === 'Map' && normalizeMapKey(entry.label) === key
  );
  if (!segment) return null;
  const s = segment.stats;
  return {
    map: displayMap(segment.label),
    matches: statNumber(s, 'Matches'),
    winRate: statNumber(s, 'Win Rate %'),
    kd: statNumber(s, 'Average K/D Ratio', 'K/D Ratio'),
    kr: statNumber(s, 'Average K/R Ratio', 'K/R Ratio'),
    adr: statNumber(s, 'ADR'),
    headshots: statNumber(s, 'Average Headshots %', 'Total Headshots %')
  };
}

function scorelineFor(
  playerStats: Record<string, string | number | null>,
  swing: number
): LiveScoreline {
  const kills = statNumber(playerStats, 'Kills');
  const deaths = statNumber(playerStats, 'Deaths');
  return {
    kills,
    deaths,
    assists: statNumber(playerStats, 'Assists'),
    kd: round(statNumber(playerStats, 'K/D Ratio') || kills / Math.max(deaths, 1), 2),
    kr: round(statNumber(playerStats, 'K/R Ratio'), 2),
    adr: round(statNumber(playerStats, 'ADR')),
    headshots: round(statNumber(playerStats, 'Headshots %')),
    mvps: statNumber(playerStats, 'MVPs'),
    firstKills: statNumber(playerStats, 'First Kills'),
    entryWins: statNumber(playerStats, 'Entry Wins'),
    entryCount: statNumber(playerStats, 'Entry Count'),
    clutchWins: statNumber(playerStats, '1v1Wins') + statNumber(playerStats, '1v2Wins'),
    clutchAttempts: statNumber(playerStats, '1v1Count') + statNumber(playerStats, '1v2Count'),
    tripleKills: statNumber(playerStats, 'Triple Kills'),
    quadroKills: statNumber(playerStats, 'Quadro Kills'),
    pentaKills: statNumber(playerStats, 'Penta Kills'),
    utilityDamage: statNumber(playerStats, 'Utility Damage'),
    enemiesFlashed: statNumber(playerStats, 'Enemies Flashed'),
    sniperKills: statNumber(playerStats, 'Sniper Kills'),
    swing
  };
}

const optionalNumber = (stats: Record<string, string | number | null> | undefined, key: string) =>
  stats && stats[key] !== undefined && stats[key] !== null && stats[key] !== ''
    ? statNumber(stats, key)
    : null;

export function buildLiveMatch(match: FaceitMatch, context: MatchContext): LiveMatch {
  const phase = matchPhase(match.status);
  const mapEntity = votedEntity(match, 'map');
  const locationEntity = votedEntity(match, 'location');
  const statsRound = context.stats?.rounds?.[0];
  const statsMap = statsRound?.round_stats?.Map ? String(statsRound.round_stats.Map) : null;
  const mapName = mapEntity?.name || (statsMap ? displayMap(statsMap) : null);
  const mapKey = mapEntity?.class_name || mapEntity?.name || statsMap;
  const rounds = statsRound ? statNumber(statsRound.round_stats, 'Rounds') || null : null;
  const trackedPlayerIds: string[] = [];

  const teams: LiveTeam[] = Object.entries(match.teams || {}).map(([faction, team]) => {
    const statsTeam = statsRound?.teams.find(
      (candidate) =>
        candidate.team_id === team.faction_id ||
        candidate.players.some((player) => team.roster.some((r) => r.player_id === player.player_id))
    );

    const players: LivePlayer[] = team.roster.map((rosterPlayer) => {
      const profile = context.profiles.get(rosterPlayer.player_id);
      const lifetime = context.lifetimes.get(rosterPlayer.player_id);
      const statsPlayer = statsTeam?.players.find((p) => p.player_id === rosterPlayer.player_id);
      const isOwner = rosterPlayer.player_id === context.ownerId;
      const isFriend = context.friendIds.has(rosterPlayer.player_id);
      if (isOwner || isFriend) trackedPlayerIds.push(rosterPlayer.player_id);
      const nickname = profile?.nickname || rosterPlayer.nickname;

      return {
        playerId: rosterPlayer.player_id,
        nickname,
        displayName: context.aliases[rosterPlayer.player_id] || nickname,
        avatar: profile?.avatar || rosterPlayer.avatar || '',
        country: (profile?.country || '').toUpperCase(),
        faceitUrl: normalizeFaceitUrl(
          profile?.faceit_url,
          `https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`
        ),
        skillLevel: profile?.games?.cs2?.skill_level || rosterPlayer.game_skill_level || 0,
        elo: profile?.games?.cs2?.faceit_elo || 0,
        membership: rosterPlayer.membership || '',
        gamePlayerName: rosterPlayer.game_player_name || '',
        verified: Boolean(profile?.verified),
        isOwner,
        isFriend,
        isLeader: team.leader === rosterPlayer.player_id,
        lifetime: lifetimeFor(lifetime),
        onMap: mapRecordFor(lifetime, mapKey ?? null),
        scoreline:
          statsPlayer && statsTeam
            ? scorelineFor(
                statsPlayer.player_stats,
                estimatedSwing(statsPlayer, statsTeam, rounds || 1)
              )
            : null,
        allStats: statsPlayer
          ? Object.entries(statsPlayer.player_stats)
              .filter(([, value]) => value !== null && value !== '')
              .map(([label, value]) => ({ label, value: String(value) }))
              .sort((a, b) => a.label.localeCompare(b.label))
          : []
      };
    });

    if (statsTeam) {
      players.sort(
        (a, b) =>
          (b.scoreline?.kills ?? 0) - (a.scoreline?.kills ?? 0) ||
          (b.scoreline?.adr ?? 0) - (a.scoreline?.adr ?? 0)
      );
    }

    const withElo = players.filter((player) => player.elo > 0);
    const teamStats = statsTeam?.team_stats;
    const score =
      match.results?.score?.[faction] ??
      match.detailed_results?.[0]?.factions?.[faction]?.score ??
      optionalNumber(teamStats, 'Final Score');

    return {
      factionId: team.faction_id,
      faction,
      name: team.name || faction,
      avatar: team.avatar || '',
      winProbability:
        typeof team.stats?.winProbability === 'number' ? round(team.stats.winProbability * 100) : null,
      averageLevel: round(team.stats?.skillLevel?.average || 0, 1),
      averageElo: withElo.length
        ? Math.round(withElo.reduce((sum, player) => sum + player.elo, 0) / withElo.length)
        : 0,
      rating: team.stats?.rating || 0,
      score: typeof score === 'number' && Number.isFinite(score) ? score : null,
      firstHalf: optionalNumber(teamStats, 'First Half Score'),
      secondHalf: optionalNumber(teamStats, 'Second Half Score'),
      overtime: optionalNumber(teamStats, 'Overtime score'),
      won: phase === 'finished' && match.results?.winner === faction,
      tracked: players.some((player) => player.isOwner || player.isFriend),
      players
    };
  });

  return {
    matchId: match.match_id,
    status: match.status,
    phase,
    source: context.source,
    competition: match.competition_name || 'FACEIT',
    region: match.region || '',
    bestOf: match.best_of || 1,
    calculateElo: Boolean(match.calculate_elo),
    map: mapName ? { name: mapName, image: safeImage(mapEntity?.image_lg || mapEntity?.image_sm) } : null,
    location: locationEntity?.name
      ? { name: locationEntity.name, image: safeImage(locationEntity.image_sm) }
      : null,
    configuredAt: match.configured_at || null,
    startedAt: match.started_at || null,
    finishedAt: match.finished_at || null,
    rounds,
    faceitUrl: normalizeFaceitUrl(match.faceit_url, `https://www.faceit.com/en/cs2/room/${match.match_id}`),
    demoAvailable: Boolean(match.demo_url?.length),
    trackedPlayerIds,
    teams
  };
}

const PHASE_ORDER: Record<LivePhase, number> = { live: 0, setup: 1, finished: 2, cancelled: 3 };

async function enrichMatch(
  match: FaceitMatch,
  context: Omit<MatchContext, 'profiles' | 'lifetimes' | 'stats' | 'source'>,
  source: LiveSource
) {
  const playerIds = Object.values(match.teams || {}).flatMap((team) =>
    team.roster.map((player) => player.player_id)
  );
  const phase = matchPhase(match.status);

  const [profiles, lifetimes, stats] = await Promise.all([
    mapWithConcurrency(playerIds, 5, (id) => getPlayer(id).catch(() => null)),
    mapWithConcurrency(playerIds, 5, (id) => getLifetimeStats(id).catch(() => null)),
    phase === 'finished' ? getMatchStats(match.match_id).catch(() => null) : Promise.resolve(null)
  ]);

  return buildLiveMatch(match, {
    ...context,
    source,
    profiles: new Map(
      profiles.filter((p): p is FaceitPlayer => p !== null).map((p) => [p.player_id, p])
    ),
    lifetimes: new Map(
      lifetimes
        .map((stats, index) => [playerIds[index], stats] as const)
        .filter((entry): entry is readonly [string, FaceitLifetimeStats] => entry[1] !== null)
    ),
    stats
  });
}

export async function buildLiveOverview(): Promise<LiveOverview> {
  const owner = await getPlayerByNickname(OWNER_NICKNAME);
  const friendIds = new Set(owner.friends_ids || []);
  const trackedIds = [...new Set([owner.player_id, ...friendIds])];
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RECENT_WINDOW_MINUTES * 60;

  const [histories, profiles, aliases] = await Promise.all([
    mapWithConcurrency(trackedIds, 6, (id) => getRecentHistory(id, 2).catch(() => null)),
    mapWithConcurrency(trackedIds, 6, (id) => getPlayer(id).catch(() => null)),
    readAliases()
  ]);

  const candidates = new Map<string, LiveSource>();
  histories.forEach((history) => {
    for (const item of history?.items || []) {
      const active = item.status.toLowerCase() !== 'finished';
      if (active || item.finished_at >= windowStart) {
        if (!candidates.has(item.match_id)) candidates.set(item.match_id, 'history');
      }
    }
  });

  const trackedSet = new Set(trackedIds);
  const webhookEvents = await webhookMatches().catch((error) => {
    console.error('Webhook registry unavailable', error);
    return [];
  });
  for (const event of webhookEvents) {
    if (!event.playerIds.length || event.playerIds.some((id) => trackedSet.has(id))) {
      candidates.set(event.matchId, 'webhook');
    }
  }

  const fetched = await mapWithConcurrency([...candidates.keys()], 4, (id) =>
    getMatch(id).catch(() => null)
  );
  const relevant = fetched
    .filter((match): match is FaceitMatch => match !== null)
    .filter((match) =>
      Object.values(match.teams || {}).some((team) =>
        team.roster.some((player) => trackedSet.has(player.player_id))
      )
    )
    .sort(
      (a, b) =>
        PHASE_ORDER[matchPhase(a.status)] - PHASE_ORDER[matchPhase(b.status)] ||
        (b.started_at || b.finished_at || 0) - (a.started_at || a.finished_at || 0)
    )
    .slice(0, MAX_MATCHES);

  const context = { ownerId: owner.player_id, friendIds, aliases };
  const matches = await mapWithConcurrency(relevant, 2, (match) =>
    enrichMatch(match, context, candidates.get(match.match_id) || 'history')
  );

  const activeByPlayer = new Map<string, string>();
  for (const match of matches) {
    if (match.phase !== 'live' && match.phase !== 'setup') continue;
    for (const id of match.trackedPlayerIds) activeByPlayer.set(id, match.matchId);
  }

  const squad: SquadMemberStatus[] = trackedIds.map((playerId, index) => {
    const profile = profiles[index];
    const lastItem = histories[index]?.items?.[0];
    const rosterEntry = lastItem
      ? Object.values(lastItem.teams)
          .flatMap((team) => team.players)
          .find((player) => player.player_id === playerId)
      : undefined;
    const nickname = profile?.nickname || rosterEntry?.nickname || 'Unknown player';
    return {
      playerId,
      nickname,
      displayName: aliases[playerId] || nickname,
      avatar: profile?.avatar || rosterEntry?.avatar || '',
      skillLevel: profile?.games?.cs2?.skill_level || rosterEntry?.skill_level || 0,
      elo: profile?.games?.cs2?.faceit_elo || 0,
      isOwner: playerId === owner.player_id,
      lastMatchAt: lastItem?.finished_at || null,
      activeMatchId: activeByPlayer.get(playerId) || null
    };
  });

  squad.sort(
    (a, b) =>
      Number(Boolean(b.activeMatchId)) - Number(Boolean(a.activeMatchId)) ||
      Number(b.isOwner) - Number(a.isOwner) ||
      (b.lastMatchAt || 0) - (a.lastMatchAt || 0)
  );

  return {
    owner: {
      playerId: owner.player_id,
      nickname: owner.nickname,
      avatar: owner.avatar || '',
      faceitUrl: normalizeFaceitUrl(
        owner.faceit_url,
        `https://www.faceit.com/en/players/${encodeURIComponent(owner.nickname)}`
      )
    },
    generatedAt: now,
    recentWindowMinutes: RECENT_WINDOW_MINUTES,
    webhookEnabled: Boolean(env.FACEIT_WEBHOOK_SECRET?.trim()),
    matches,
    squad
  };
}

export async function buildLookupMatch(matchId: string): Promise<LiveMatch> {
  const owner = await getPlayerByNickname(OWNER_NICKNAME);
  const [match, aliases] = await Promise.all([getMatch(matchId), readAliases()]);
  return enrichMatch(
    match,
    { ownerId: owner.player_id, friendIds: new Set(owner.friends_ids || []), aliases },
    'lookup'
  );
}
