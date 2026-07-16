import { env } from '$env/dynamic/private';
import type {
  DashboardData,
  MapPerformance,
  MatchPerformance,
  SquadPlayer,
  SwingSource
} from '$lib/types';
import { readAliases } from './aliases';
import { estimatedSwing, findPlayerTeam, officialSwing, round, statNumber } from './analytics';
import {
  getMatchStats,
  getPlayer,
  getPlayerByNickname,
  getPlayerHistory,
  mapWithConcurrency,
  type FaceitHistoryMatch,
  type FaceitMatchStats,
  type FaceitPlayer,
  type FaceitRosterPlayer,
  type FaceitStatsPlayer
} from './faceit';

const OWNER_NICKNAME = env.FACEIT_OWNER_NICKNAME || 'Christian976';

type PlayerRecord = MatchPerformance & {
  swingSource: SwingSource;
  entryWins: number;
  entryCount: number;
  rounds: number;
};

type PlayerAccumulator = {
  roster: FaceitRosterPlayer;
  profile: FaceitPlayer | null;
  appearances: number;
  statsMatches: number;
  wins: number;
  losses: number;
  results: Array<'W' | 'L'>;
  records: PlayerRecord[];
};

function normalizeFaceitUrl(value: string | undefined, fallback: string) {
  return (value || fallback).replace('{lang}', 'en');
}

function findHistoryTeam(match: FaceitHistoryMatch, playerId: string) {
  return Object.entries(match.teams).find(([, team]) =>
    team.players.some((player) => player.player_id === playerId)
  );
}

function displayMap(value: string) {
  const map = value.replace(/^de_/, '').replaceAll('_', ' ');
  return map ? map.charAt(0).toUpperCase() + map.slice(1) : 'Unknown';
}

function scoreFor(match: FaceitHistoryMatch, ownerFaction: string) {
  const otherFaction = Object.keys(match.teams).find((faction) => faction !== ownerFaction);
  const ours = match.results?.score?.[ownerFaction];
  const theirs = otherFaction ? match.results?.score?.[otherFaction] : undefined;
  return Number.isFinite(ours) && Number.isFinite(theirs) ? `${ours}–${theirs}` : '—';
}

function average(records: PlayerRecord[], selector: (record: PlayerRecord) => number) {
  if (!records.length) return 0;
  return records.reduce((sum, record) => sum + selector(record), 0) / records.length;
}

function mapBreakdown(records: PlayerRecord[]): MapPerformance[] {
  const groups = new Map<string, PlayerRecord[]>();
  for (const record of records) {
    const group = groups.get(record.map) || [];
    group.push(record);
    groups.set(record.map, group);
  }

  return [...groups.entries()]
    .map(([map, matches]) => {
      const wins = matches.filter((match) => match.result === 'W').length;
      return {
        map,
        matches: matches.length,
        wins,
        winRate: round((wins / matches.length) * 100),
        swing: round(matches.reduce((sum, match) => sum + match.swing, 0) / matches.length, 2),
        adr: round(matches.reduce((sum, match) => sum + match.adr, 0) / matches.length),
        kd: round(matches.reduce((sum, match) => sum + match.kd, 0) / matches.length, 2)
      };
    })
    .sort((a, b) => b.matches - a.matches || b.swing - a.swing);
}

function buildPlayer(
  accumulator: PlayerAccumulator,
  alias: string | undefined
): SquadPlayer {
  const { profile, roster, records } = accumulator;
  const game = profile?.games?.cs2;
  const maps = mapBreakdown(records);
  const entryCount = records.reduce((sum, record) => sum + record.entryCount, 0);
  const entryWins = records.reduce((sum, record) => sum + record.entryWins, 0);
  const officialMatches = records.filter((record) => record.swingSource === 'faceit').length;
  const swingSource: SwingSource =
    records.length > 0 && officialMatches === records.length ? 'faceit' : 'estimated';

  return {
    playerId: roster.player_id,
    nickname: profile?.nickname || roster.nickname,
    displayName: alias || profile?.nickname || roster.nickname,
    alias: alias || null,
    avatar: profile?.avatar || roster.avatar || '',
    country: (profile?.country || '').toUpperCase(),
    faceitUrl: normalizeFaceitUrl(
      profile?.faceit_url || roster.faceit_url,
      `https://www.faceit.com/en/players/${encodeURIComponent(profile?.nickname || roster.nickname)}`
    ),
    verified: Boolean(profile?.verified),
    elo: game?.faceit_elo || 0,
    skillLevel: game?.skill_level || roster.skill_level || 0,
    matches: accumulator.appearances,
    statsMatches: accumulator.statsMatches,
    wins: accumulator.wins,
    losses: accumulator.losses,
    winRate: accumulator.appearances
      ? round((accumulator.wins / accumulator.appearances) * 100)
      : 0,
    swing: round(average(records, (record) => record.swing), 2),
    swingSource,
    adr: round(average(records, (record) => record.adr)),
    kd: round(average(records, (record) => record.kd), 2),
    kr: round(
      records.reduce((sum, record) => sum + record.kills, 0) /
        Math.max(records.reduce((sum, record) => sum + record.rounds, 0), 1),
      2
    ),
    headshots: round(average(records, (record) => record.headshots)),
    assistsPerMatch: round(average(records, (record) => record.assists)),
    entrySuccess: entryCount ? round((entryWins / entryCount) * 100) : null,
    currentForm: accumulator.results.slice(0, 5),
    trend: records
      .slice(0, 8)
      .reverse()
      .map((record) => record.swing),
    lastPlayedAt: records[0]?.playedAt || 0,
    bestMap: maps.length
      ? [...maps].sort((a, b) => b.swing - a.swing || b.winRate - a.winRate)[0]
      : null,
    maps,
    recentMatches: records.slice(0, 8)
  };
}

export async function buildDashboard(lookback: number): Promise<DashboardData> {
  const owner = await getPlayerByNickname(OWNER_NICKNAME);
  const historyResponse = await getPlayerHistory(owner.player_id, lookback);
  const history = historyResponse.items.filter((match) => match.status === 'finished');
  const friendIds = new Set(owner.friends_ids || []);
  const teammates = new Map<string, FaceitRosterPlayer>();

  for (const match of history) {
    const ownerTeam = findHistoryTeam(match, owner.player_id)?.[1];
    for (const player of ownerTeam?.players || []) {
      if (player.player_id !== owner.player_id) teammates.set(player.player_id, player);
    }
  }

  const recentFriendIds = [...teammates.keys()].filter((playerId) => friendIds.has(playerId));
  const candidateIds = recentFriendIds.length ? recentFriendIds : [...teammates.keys()];
  const candidateSet = new Set(candidateIds);
  const source = recentFriendIds.length ? 'recent-friends' : 'recent-teammates';

  const [profiles, statsByMatch, aliases] = await Promise.all([
    mapWithConcurrency(candidateIds, 5, async (playerId) => {
      try {
        return await getPlayer(playerId);
      } catch {
        return null;
      }
    }),
    mapWithConcurrency(history, 4, async (match) => {
      try {
        return await getMatchStats(match.match_id);
      } catch {
        return null;
      }
    }),
    readAliases()
  ]);

  const accumulators = new Map<string, PlayerAccumulator>();
  candidateIds.forEach((playerId, index) => {
    accumulators.set(playerId, {
      roster: teammates.get(playerId)!,
      profile: profiles[index],
      appearances: 0,
      statsMatches: 0,
      wins: 0,
      losses: 0,
      results: [],
      records: []
    });
  });

  let ownerWins = 0;
  let ownerLosses = 0;
  const ownerForm: Array<'W' | 'L'> = [];
  const ownerMapRecords: Array<{ map: string; result: 'W' | 'L'; adr: number }> = [];
  const recentMatches: DashboardData['recentMatches'] = [];

  history.forEach((match, index) => {
    const historyTeamEntry = findHistoryTeam(match, owner.player_id);
    if (!historyTeamEntry) return;

    const [ownerFaction, ownerHistoryTeam] = historyTeamEntry;
    const result: 'W' | 'L' = match.results?.winner === ownerFaction ? 'W' : 'L';
    if (result === 'W') ownerWins += 1;
    else ownerLosses += 1;
    ownerForm.push(result);

    const stats = statsByMatch[index] as FaceitMatchStats | null;
    const statsRound = stats?.rounds?.[0];
    const rounds = statNumber(statsRound?.round_stats, 'Rounds') || 1;
    const statsTeam = statsRound ? findPlayerTeam(statsRound.teams, owner.player_id) : undefined;
    const map = displayMap(String(statsRound?.round_stats?.Map || 'Unknown'));
    const teammateIds = ownerHistoryTeam.players
      .map((player) => player.player_id)
      .filter((playerId) => candidateSet.has(playerId));

    const ownerStats = statsTeam?.players.find((player) => player.player_id === owner.player_id);
    ownerMapRecords.push({
      map,
      result,
      adr: ownerStats ? statNumber(ownerStats.player_stats, 'ADR') : 0
    });

    recentMatches.push({
      matchId: match.match_id,
      playedAt: match.finished_at,
      map,
      result,
      score: scoreFor(match, ownerFaction),
      teammateIds,
      faceitUrl: normalizeFaceitUrl(
        match.faceit_url,
        `https://www.faceit.com/en/cs2/room/${match.match_id}`
      )
    });

    for (const rosterPlayer of ownerHistoryTeam.players) {
      const accumulator = accumulators.get(rosterPlayer.player_id);
      if (!accumulator) continue;

      accumulator.appearances += 1;
      accumulator.results.push(result);
      if (result === 'W') accumulator.wins += 1;
      else accumulator.losses += 1;

      const statsPlayer = statsTeam?.players.find(
        (player) => player.player_id === rosterPlayer.player_id
      );
      if (!statsPlayer || !statsTeam) continue;

      accumulator.statsMatches += 1;
      const playerStats = statsPlayer.player_stats;
      const kills = statNumber(playerStats, 'Kills');
      const deaths = statNumber(playerStats, 'Deaths');
      const directSwing = officialSwing(playerStats);

      accumulator.records.push({
        matchId: match.match_id,
        playedAt: match.finished_at,
        map,
        result,
        score: scoreFor(match, ownerFaction),
        kills,
        deaths,
        assists: statNumber(playerStats, 'Assists'),
        adr: round(statNumber(playerStats, 'ADR')),
        kd: round(statNumber(playerStats, 'K/D Ratio') || kills / Math.max(deaths, 1), 2),
        headshots: round(statNumber(playerStats, 'Headshots %')),
        swing:
          directSwing === null
            ? estimatedSwing(statsPlayer as FaceitStatsPlayer, statsTeam, rounds)
            : round(directSwing, 2),
        swingSource: directSwing === null ? 'estimated' : 'faceit',
        entryWins: statNumber(playerStats, 'Entry Wins'),
        entryCount: statNumber(playerStats, 'Entry Count'),
        rounds,
        faceitUrl: normalizeFaceitUrl(
          match.faceit_url,
          `https://www.faceit.com/en/cs2/room/${match.match_id}`
        )
      });
    }
  });

  const players = [...accumulators.values()]
    .map((accumulator) => buildPlayer(accumulator, aliases[accumulator.roster.player_id]))
    .sort((a, b) => b.swing - a.swing || b.matches - a.matches);

  const mapGroups = new Map<string, typeof ownerMapRecords>();
  for (const record of ownerMapRecords) {
    const group = mapGroups.get(record.map) || [];
    group.push(record);
    mapGroups.set(record.map, group);
  }

  const maps = [...mapGroups.entries()]
    .map(([map, records]) => {
      const wins = records.filter((record) => record.result === 'W').length;
      const withAdr = records.filter((record) => record.adr > 0);
      return {
        map,
        matches: records.length,
        wins,
        winRate: round((wins / records.length) * 100),
        ownerAdr: withAdr.length
          ? round(withAdr.reduce((sum, record) => sum + record.adr, 0) / withAdr.length)
          : 0
      };
    })
    .sort((a, b) => b.matches - a.matches || b.winRate - a.winRate);

  const ownerGame = owner.games?.cs2;
  const swingSource: SwingSource =
    players.length > 0 && players.every((player) => player.swingSource === 'faceit')
      ? 'faceit'
      : 'estimated';

  return {
    owner: {
      playerId: owner.player_id,
      nickname: owner.nickname,
      avatar: owner.avatar || '',
      country: (owner.country || '').toUpperCase(),
      faceitUrl: normalizeFaceitUrl(
        owner.faceit_url,
        `https://www.faceit.com/en/players/${encodeURIComponent(owner.nickname)}`
      ),
      elo: ownerGame?.faceit_elo || 0,
      skillLevel: ownerGame?.skill_level || 0,
      winRate: history.length ? round((ownerWins / history.length) * 100) : 0,
      wins: ownerWins,
      losses: ownerLosses,
      form: ownerForm.slice(0, 8)
    },
    lookback,
    matchesAnalyzed: history.length,
    source,
    sourceLabel:
      source === 'recent-friends'
        ? `FACEIT friends active in the last ${history.length} matches`
        : `Recent teammates active in the last ${history.length} matches`,
    generatedAt: Math.floor(Date.now() / 1000),
    swingSource,
    players,
    recentMatches,
    maps
  };
}
