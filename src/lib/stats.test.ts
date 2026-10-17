import { describe, expect, it } from 'vitest';
import {
  groupGames,
  mapForm,
  pairRecords,
  summarize,
  toLineup,
  toPlayerMatch,
  togetherMaps,
  weekStart,
  longActivity,
  monthStarts,
  recentActivity,
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

describe('mapForm', () => {
  it('returns no maps without matches', () => {
    expect(mapForm([])).toEqual([]);
  });

  it('splits matches by map, most played first, ties by name', () => {
    const maps = mapForm([
      match({ map: 'Nuke' }),
      match({ map: 'Dust2' }),
      match({ map: 'Mirage' }),
      match({ map: 'Dust2', won: false }),
      match({ map: 'Ancient' })
    ]);
    expect(maps.map((map) => [map.map, map.matches])).toEqual([
      ['Dust2', 2],
      ['Ancient', 1],
      ['Mirage', 1],
      ['Nuke', 1]
    ]);
    expect(maps[0]).toMatchObject({ wins: 1, winRate: 50 });
  });

  it('totals each map like summarize does', () => {
    const [mirage] = mapForm([
      match({ kills: 30, deaths: 10, damage: 3000, rounds: 30 }),
      match({ won: false, kills: 10, deaths: 20, damage: 1000, rounds: 20 }),
      match({ map: 'Inferno', kills: 5, deaths: 25 })
    ]);
    expect(mirage).toEqual({ map: 'Mirage', matches: 2, wins: 1, winRate: 50, kd: 40 / 30, adr: 4000 / 50 });
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

  it('counts pairs from the grouped games', () => {
    const games = groupGames(players);
    expect(pairRecords(games)).toEqual([{ a: 'a', b: 'b', matches: 1, wins: 1, winRate: 100 }]);
  });
});

describe('together maps', () => {
  const lineup = (map: string, won: boolean, ids: string[]) => ({
    map,
    won,
    lines: ids.map((playerId) => ({ playerId, kills: 10, deaths: 5 }))
  });
  const lineups = [
    lineup('Mirage', true, ['a', 'b', 'c']),
    lineup('Mirage', false, ['a', 'c']),
    lineup('Dust2', true, ['b', 'c'])
  ];

  it('keeps only who played and how it went', () => {
    const [game] = groupGames([
      { playerId: 'a', matches: [match({ kills: 25, deaths: 9 })] },
      { playerId: 'b', matches: [match({ kills: 12, deaths: 14 })] }
    ]);
    expect(toLineup(game)).toEqual({
      map: 'Mirage',
      won: true,
      lines: [
        { playerId: 'a', kills: 25, deaths: 9 },
        { playerId: 'b', kills: 12, deaths: 14 }
      ]
    });
  });

  it('counts every game when everyone is chosen', () => {
    const maps = togetherMaps(lineups, new Set(['a', 'b', 'c']));
    expect(maps.get('Mirage')).toEqual({ map: 'Mirage', matches: 2, wins: 1, kills: 50, deaths: 25 });
    expect(maps.get('Dust2')?.matches).toBe(1);
  });

  it('drops games left with fewer than two chosen teammates, and their kills', () => {
    const maps = togetherMaps(lineups, new Set(['a', 'b']));
    expect(maps.get('Mirage')).toEqual({ map: 'Mirage', matches: 1, wins: 1, kills: 20, deaths: 10 });
    expect(maps.has('Dust2')).toBe(false);
  });

  it('stops after the latest `limit` games the chosen played together', () => {
    const maps = togetherMaps(lineups, new Set(['b', 'c']), 1);
    expect(maps.get('Mirage')?.matches).toBe(1);
    expect(maps.has('Dust2')).toBe(false);
  });
});

describe('weekly activity', () => {
  it('starts weeks on Monday UTC', () => {
    // 2026-10-17 is a Saturday; its week starts on Monday 2026-10-12.
    const saturday = Date.UTC(2026, 9, 17, 15) / 1000;
    expect(new Date(weekStart(saturday) * 1000).toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });

  it('buckets matches into days and weeks, oldest first', () => {
    const now = Date.UTC(2026, 9, 17, 15) / 1000;
    const thisWeek = weekStart(now) + DAY;
    const lastWeek = thisWeek - 7 * DAY;
    const tooOld = thisWeek - 30 * DAY;
    const { dayStarts, weekStarts, rows } = recentActivity(
      [{ playerId: 'a', matches: [match({ finishedAt: thisWeek }), match({ finishedAt: lastWeek }), match({ finishedAt: tooOld })] }],
      14,
      3,
      now
    );
    expect(weekStarts).toHaveLength(3);
    expect(rows[0].weeks).toEqual([0, 1, 1]);
    // Today is Saturday 17 Oct, so the 14 days start on Sunday 4 Oct.
    expect(new Date(dayStarts[0] * 1000).toISOString()).toBe('2026-10-04T00:00:00.000Z');
    expect(rows[0].days.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(rows[0].days[dayStarts.indexOf(thisWeek)]).toBe(1);
  });
});

describe('long activity', () => {
  it('counts back months across a new year', () => {
    const now = Date.UTC(2026, 1, 10) / 1000;
    expect(monthStarts(3, now).map((start) => new Date(start * 1000).toISOString().slice(0, 7))).toEqual([
      '2025-12',
      '2026-01',
      '2026-02'
    ]);
  });

  it('counts per month and per year from the first match', () => {
    const now = Date.UTC(2026, 9, 17) / 1000;
    const { monthStarts: months, yearStarts: years, rows } = longActivity(
      [
        { playerId: 'a', matches: [{ finishedAt: Date.UTC(2026, 9, 2) / 1000 }, { finishedAt: Date.UTC(2024, 4, 1) / 1000 }] },
        { playerId: 'b', matches: [{ finishedAt: Date.UTC(2026, 8, 30) / 1000 }] }
      ],
      2,
      now
    );
    expect(months).toHaveLength(2);
    expect(years.map((start) => new Date(start * 1000).getUTCFullYear())).toEqual([2024, 2025, 2026]);
    expect(rows[0]).toEqual({ playerId: 'a', months: [0, 1], years: [1, 0, 1] });
    expect(rows[1]).toEqual({ playerId: 'b', months: [1, 0], years: [0, 0, 1] });
  });
});
