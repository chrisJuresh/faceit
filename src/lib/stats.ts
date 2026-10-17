import type {
  GameLine,
  GroupGame,
  GroupLineup,
  MapForm,
  PairRecord,
  PlayerMatch,
  Summary,
  TogetherMap
} from './types';

/** A parsed FACEIT match-stats row with the fields only the server needs. */
export interface HistoryMatch extends PlayerMatch {
  /** Map number inside a best-of series; 1 for normal queue matches. */
  mapNumber: number;
  /** FACEIT's team label for the match, used to tell whether two players were teammates. */
  team: string;
  damage: number;
}

export interface PlayerMatches {
  playerId: string;
  /** Newest first. */
  matches: HistoryMatch[];
}

const ratio = (top: number, bottom: number) => (bottom ? top / bottom : 0);

export function toPlayerMatch({ mapNumber, team, damage, ...match }: HistoryMatch): PlayerMatch {
  return match;
}

function toLine(playerId: string, match: HistoryMatch): GameLine {
  return {
    playerId,
    kills: match.kills,
    deaths: match.deaths,
    assists: match.assists,
    adr: match.adr,
    headshots: match.headshots,
    mvps: match.mvps,
    tripleKills: match.tripleKills,
    quadroKills: match.quadroKills,
    pentaKills: match.pentaKills
  };
}

export function summarize(matches: HistoryMatch[]): Summary | null {
  if (!matches.length) return null;
  const sum = (pick: (match: HistoryMatch) => number) =>
    matches.reduce((total, match) => total + pick(match), 0);

  const wins = matches.filter((match) => match.won).length;
  const rounds = sum((match) => match.rounds);
  const kills = sum((match) => match.kills);
  const deaths = sum((match) => match.deaths);
  const assists = sum((match) => match.assists);
  const damage = sum((match) => match.damage);
  const roundsWithDamage = sum((match) => (match.damage ? match.rounds : 0));

  return {
    matches: matches.length,
    wins,
    losses: matches.length - wins,
    winRate: ratio(wins, matches.length) * 100,
    rounds,
    kills,
    deaths,
    assists,
    kd: deaths ? kills / deaths : kills,
    kr: ratio(kills, rounds),
    // Rows without raw damage fall back to averaging FACEIT's per-match ADR.
    adr: roundsWithDamage
      ? damage / roundsWithDamage
      : ratio(sum((match) => match.adr), matches.length),
    headshots: ratio(sum((match) => match.headshots), kills) * 100,
    avgKills: ratio(kills, matches.length),
    avgAssists: ratio(assists, matches.length),
    mvpsPerMatch: ratio(sum((match) => match.mvps), matches.length),
    doubleKills: sum((match) => match.doubleKills),
    tripleKills: sum((match) => match.tripleKills),
    quadroKills: sum((match) => match.quadroKills),
    pentaKills: sum((match) => match.pentaKills)
  };
}

/** Per-map records over `matches`, totalled the same way as `summarize`, most played first. */
export function mapForm(matches: HistoryMatch[]): MapForm[] {
  const byMap = new Map<string, HistoryMatch[]>();
  for (const match of matches) {
    const played = byMap.get(match.map) ?? [];
    played.push(match);
    byMap.set(match.map, played);
  }

  return [...byMap]
    .map(([map, played]) => {
      const { matches, wins, winRate, kd, adr } = summarize(played)!;
      return { map, matches, wins, winRate, kd, adr };
    })
    .sort((a, b) => b.matches - a.matches || a.map.localeCompare(b.map));
}

export const countSince =(matches: PlayerMatch[], since: number) =>
  matches.filter((match) => match.finishedAt >= since).length;

/** Two players were teammates when FACEIT lists them under the same team in the same match. */
const gameKey = (match: HistoryMatch) => `${match.matchId}:${match.mapNumber}:${match.team}`;

/** Matches where at least `minPlayers` of the group were on the same team, newest first. */
export function groupGames(players: PlayerMatches[], minPlayers = 2): GroupGame[] {
  const games = new Map<string, GroupGame>();
  for (const player of players) {
    for (const match of player.matches) {
      const key = gameKey(match);
      let game = games.get(key);
      if (!game) {
        game = {
          key,
          matchId: match.matchId,
          finishedAt: match.finishedAt,
          map: match.map,
          won: match.won,
          teamScore: match.teamScore,
          enemyScore: match.enemyScore,
          rounds: match.rounds,
          lines: []
        };
        games.set(key, game);
      }
      game.lines.push(toLine(player.playerId, match));
    }
  }

  return [...games.values()]
    .filter((game) => game.lines.length >= minPlayers)
    .map((game) => ({
      ...game,
      lines: [...game.lines].sort((a, b) => b.kills - a.kills || b.adr - a.adr)
    }))
    .sort((a, b) => b.finishedAt - a.finishedAt);
}

/** Win/loss for every pair who were on the same team in `games`, most games first. */
export function pairRecords(games: GroupGame[]): PairRecord[] {
  const pairs = new Map<string, PairRecord>();
  for (const game of games) {
    const ids = [...new Set(game.lines.map((line) => line.playerId))].sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = `${ids[i]}|${ids[j]}`;
        const record = pairs.get(key) ?? { a: ids[i], b: ids[j], matches: 0, wins: 0, winRate: 0 };
        record.matches += 1;
        if (game.won) record.wins += 1;
        record.winRate = (record.wins / record.matches) * 100;
        pairs.set(key, record);
      }
    }
  }
  return [...pairs.values()].sort((x, y) => y.matches - x.matches || y.winRate - x.winRate);
}

export function toLineup(game: GroupGame): GroupLineup {
  return {
    map: game.map,
    won: game.won,
    lines: game.lines.map(({ playerId, kills, deaths }) => ({ playerId, kills, deaths }))
  };
}

/**
 * Map records for the games where at least two of `chosen` were on the same team. Kills and
 * deaths add up the chosen players only, so leaving someone out removes their share too.
 */
export function togetherMaps(lineups: GroupLineup[], chosen: ReadonlySet<string>) {
  const maps = new Map<string, TogetherMap>();
  for (const game of lineups) {
    const lines = game.lines.filter((line) => chosen.has(line.playerId));
    if (lines.length < 2) continue;
    const record = maps.get(game.map) ?? { map: game.map, matches: 0, wins: 0, kills: 0, deaths: 0 };
    record.matches += 1;
    if (game.won) record.wins += 1;
    for (const line of lines) {
      record.kills += line.kills;
      record.deaths += line.deaths;
    }
    maps.set(game.map, record);
  }
  return maps;
}

const DAY = 86_400;

/** Monday 00:00 UTC of the week containing `timestamp`. */
export function weekStart(timestamp: number) {
  const day = Math.floor(timestamp / DAY) * DAY;
  const weekday = (new Date(day * 1000).getUTCDay() + 6) % 7;
  return day - weekday * DAY;
}

/** Match finish times for one player, in any order. */
export interface PlayerTimes {
  playerId: string;
  matches: Array<{ finishedAt: number }>;
}

/**
 * Each player's matches counted into the periods that begin at `starts` (ascending, UTC). The last
 * period runs on to now; matches before the first are left out.
 */
export function countByPeriod(players: PlayerTimes[], starts: number[]) {
  return players.map((player) => {
    const counts = starts.map(() => 0);
    for (const match of player.matches) {
      if (match.finishedAt < starts[0]) continue;
      let index = starts.length - 1;
      while (match.finishedAt < starts[index]) index -= 1;
      counts[index] += 1;
    }
    return counts;
  });
}

/** 00:00 UTC of each of the last `count` days, oldest first, ending with today. */
export function dayStarts(count: number, now: number) {
  const today = Math.floor(now / DAY) * DAY;
  return Array.from({ length: count }, (_, index) => today - (count - 1 - index) * DAY);
}

/** Monday 00:00 UTC of each of the last `count` weeks, oldest first, ending with this week. */
export function weekStarts(count: number, now: number) {
  const current = weekStart(now);
  return Array.from({ length: count }, (_, index) => current - (count - 1 - index) * 7 * DAY);
}

/** The 1st, 00:00 UTC, of each of the last `count` months, oldest first, ending with this month. */
export function monthStarts(count: number, now: number) {
  const today = new Date(now * 1000);
  return Array.from(
    { length: count },
    (_, index) => Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (count - 1 - index), 1) / 1000
  );
}

/** 1 January, 00:00 UTC, of each year from `firstYear` to this year. */
export function yearStarts(firstYear: number, now: number) {
  const thisYear = new Date(now * 1000).getUTCFullYear();
  const from = Math.min(firstYear, thisYear);
  return Array.from({ length: thisYear - from + 1 }, (_, index) => Date.UTC(from + index, 0, 1) / 1000);
}

/** Matches per player per day and per week over the latest `days` days and `weeks` weeks. */
export function recentActivity(players: PlayerTimes[], days: number, weeks: number, now: number) {
  const dayList = dayStarts(days, now);
  const weekList = weekStarts(weeks, now);
  const byDay = countByPeriod(players, dayList);
  const byWeek = countByPeriod(players, weekList);
  return {
    dayStarts: dayList,
    weekStarts: weekList,
    rows: players.map((player, index) => ({ playerId: player.playerId, days: byDay[index], weeks: byWeek[index] }))
  };
}

/**
 * Matches per player per month over the latest `months` months, and per year from the year of the
 * group's first match.
 */
export function longActivity(players: PlayerTimes[], months: number, now: number) {
  let first = now;
  for (const player of players) for (const match of player.matches) first = Math.min(first, match.finishedAt);
  const monthList = monthStarts(months, now);
  const yearList = yearStarts(new Date(first * 1000).getUTCFullYear(), now);
  const byMonth = countByPeriod(players, monthList);
  const byYear = countByPeriod(players, yearList);
  return {
    monthStarts: monthList,
    yearStarts: yearList,
    rows: players.map((player, index) => ({ playerId: player.playerId, months: byMonth[index], years: byYear[index] }))
  };
}
