import { describe, expect, it } from 'vitest';
import {
  groupGames,
  mapRecords,
  pairRecords,
  summarize,
  toPlayerMatch,
  weekStart,
  weeklyActivity,
  type HistoryMatch
} from './stats';

const DAY = 86_400;

const match = (overrides: Partial<HistoryMatch> = {}): HistoryMatch => ({
  matchId: 'm1',
  mapNumber: 1,
  finishedAt: 1_790_000_000,
  map: 'Mirage',
  won: true,
  teamScore: 13,
  enemyScore: 9,
  team: 'team_a',
  rounds: 22,
  kills: 20,
  deaths: 10,
  assists: 4,
  headshots: 10,
  damage: 2200,
  adr: 100,
  mvps: 3,
  doubleKills: 2,
  tripleKills: 1,
  quadroKills: 0,
  pentaKills: 0,
  ...overrides
});

describe('summarize', () => {
  it('returns null without matches', () => {
    expect(summarize([])).toBeNull();
  });

  it('aggregates totals instead of averaging per-match ratios', () => {
    const summary = summarize([
      match({ kills: 30, deaths: 10, headshots: 15, damage: 3000, rounds: 30 }),
      match({ won: false, kills: 10, deaths: 20, headshots: 2, damage: 1000, rounds: 20 })
    ])!;

    expect(summary.matches).toBe(2);
    expect(summary.wins).toBe(1);
    expect(summary.winRate).toBe(50);
    expect(summary.kd).toBeCloseTo(40 / 30);
    expect(summary.kr).toBeCloseTo(40 / 50);
    expect(summary.adr).toBeCloseTo(4000 / 50);
    expect(summary.headshots).toBeCloseTo((17 / 40) * 100);
    expect(summary.avgKills).toBe(20);
  });

  it('falls back to per-match ADR when raw damage is missing', () => {
    const summary = summarize([match({ damage: 0, adr: 80 }), match({ damage: 0, adr: 60 })])!;
    expect(summary.adr).toBe(70);
  });
});

describe('toPlayerMatch', () => {
  it('drops server-only fields', () => {
    const slim = toPlayerMatch(match());
    expect(slim).not.toHaveProperty('team');
    expect(slim).not.toHaveProperty('damage');
    expect(slim).not.toHaveProperty('mapNumber');
    expect(slim.kills).toBe(20);
  });
});

describe('group games', () => {
  const players = [
    {
      playerId: 'a',
      matches: [match({ matchId: 'm2', finishedAt: 2_000, kills: 25 }), match({ matchId: 'm1' })]
    },
    {
      playerId: 'b',
      matches: [
        match({ matchId: 'm2', finishedAt: 2_000, kills: 12 }),
        match({ matchId: 'm3', team: 'team_x', won: false })
      ]
    },
    { playerId: 'c', matches: [match({ matchId: 'm3', team: 'team_y' })] }
  ];

  it('groups teammates by match and team, newest first', () => {
    const games = groupGames(players);
    expect(games.map((game) => game.matchId)).toEqual(['m2']);
    expect(games[0].lines.map((line) => line.playerId)).toEqual(['a', 'b']);
  });

  it('does not group players who were on opposite teams', () => {
    expect(groupGames(players).some((game) => game.matchId === 'm3')).toBe(false);
  });

  it('counts pairs and map records from the grouped games', () => {
    const games = groupGames(players);
    expect(pairRecords(games)).toEqual([{ a: 'a', b: 'b', matches: 1, wins: 1, winRate: 100 }]);
    expect(mapRecords(games)).toEqual([{ map: 'Mirage', matches: 1, wins: 1 }]);
  });
});

describe('weekly activity', () => {
  it('starts weeks on Monday UTC', () => {
    // 2026-10-17 is a Saturday; its week starts on Monday 2026-10-12.
    const saturday = Date.UTC(2026, 9, 17, 15) / 1000;
    expect(new Date(weekStart(saturday) * 1000).toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });

  it('buckets matches into weeks, oldest first', () => {
    const now = Date.UTC(2026, 9, 17, 15) / 1000;
    const thisWeek = weekStart(now) + DAY;
    const lastWeek = thisWeek - 7 * DAY;
    const tooOld = thisWeek - 30 * DAY;
    const { weekStarts, rows } = weeklyActivity(
      [{ playerId: 'a', matches: [match({ finishedAt: thisWeek }), match({ finishedAt: lastWeek }), match({ finishedAt: tooOld })] }],
      3,
      now
    );
    expect(weekStarts).toHaveLength(3);
    expect(rows[0].counts).toEqual([0, 1, 1]);
  });
});
