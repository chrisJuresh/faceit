import { describe, expect, it } from 'vitest';
import {
  allColumns,
  columnGroups,
  formatValue,
  isLowSample,
  sortByName,
  sortPlayers
} from './columns';
import type { SquadPlayer, Summary } from './types';

const columns = [
  ...allColumns(columnGroups('core', 'last10')),
  ...allColumns(columnGroups('core', 'lifetime')),
  ...allColumns(columnGroups('duels', 'lifetime'))
];
const column = (key: string) => columns.find((entry) => entry.key === key)!;
const keys = (view: 'core' | 'duels', scope: 'last10' | 'lifetime') =>
  columnGroups(view, scope).map((group) => group.label);

const summary = (kd: number, matches = 10): Summary => ({
  matches,
  wins: 6,
  losses: 4,
  winRate: 60,
  rounds: 200,
  kills: 150,
  deaths: 150,
  assists: 40,
  kd,
  kr: 0.75,
  adr: 80,
  headshots: 45,
  avgKills: 15,
  avgAssists: 4,
  mvpsPerMatch: 2,
  doubleKills: 10,
  tripleKills: 3,
  quadroKills: 1,
  pentaKills: 0
});

const player = (name: string, kd: number | null, lifetimeKd: number | null, elo = 1000): SquadPlayer =>
  ({
    playerId: name,
    displayName: name,
    elo,
    played: { days7: 1, days30: 4, days90: 12 },
    lastMatchAt: 1_790_000_000,
    form: { last10: kd === null ? null : summary(kd), last30: null, last100: null },
    lifetime:
      lifetimeKd === null
        ? null
        : { kd: lifetimeKd, matches: 100, wins: 55, entrySuccess: 50, clutch1v1: 40, clutch1v1Count: 30, currentStreak: 2 }
  }) as unknown as SquadPlayer;

describe('columns', () => {
  const players = [player('a', 1.1, 0.9), player('b', null, 1.3), player('c', 1.4, null)];

  it('swaps per-match and multi-kill groups for win streaks in lifetime', () => {
    expect(keys('core', 'last10')).toEqual(['Results', 'Fragging', 'Per match', 'Multi-kills', 'Form', 'Played']);
    expect(keys('core', 'lifetime')).toEqual(['Results', 'Fragging', 'Win streak', 'Form', 'Played']);
    expect(keys('duels', 'last10')).toEqual(['Lifetime', 'Entry', 'Clutch', 'Utility', 'Flash', 'Sniper']);
  });

  it('reads the selected scope', () => {
    expect(column('kd').value(players[0], 'last10')).toBe(1.1);
    expect(column('kd').value(players[0], 'lifetime')).toBe(0.9);
    expect(column('doubles').value(players[0], 'last10')).toBe(10);
    expect(column('streak').value(players[0], 'last10')).toBe(2);
    expect(column('days30').value(players[0], 'lifetime')).toBe(4);
  });

  it('shows a W–L record and sorts it by wins', () => {
    expect(column('record').text?.(players[0], 'last10')).toBe('6–4');
    expect(column('record').text?.(players[0], 'lifetime')).toBe('55–45');
    const veteran = { ...players[0], lifetime: { ...players[0].lifetime!, matches: 2500, wins: 1312 } } as SquadPlayer;
    expect(column('record').text?.(veteran, 'lifetime')).toBe('1,312–1,188');
    expect(column('record').value(players[0], 'last10')).toBe(6);
  });

  it('reads duel columns from the lifetime record with their sample size', () => {
    expect(column('entrySuccess').value(players[0], 'lifetime')).toBe(50);
    expect(column('clutch1v1').sample?.(players[0])).toBe(30);
    expect(column('clutch1v1Count').value(players[0], 'lifetime')).toBe(30);
    expect(column('entrySuccess').value(players[2], 'lifetime')).toBeNull();
  });

  it('sorts both ways and keeps empty values last', () => {
    const kd = column('kd');
    expect(sortPlayers(players, kd, 'last10', 'desc').map((p) => p.playerId)).toEqual(['c', 'a', 'b']);
    expect(sortPlayers(players, kd, 'last10', 'asc').map((p) => p.playerId)).toEqual(['a', 'c', 'b']);
    expect(sortPlayers(players, kd, 'lifetime', 'desc').map((p) => p.playerId)).toEqual(['b', 'a', 'c']);
    expect(sortByName([players[2], players[0], players[1]], 'asc').map((p) => p.playerId)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties by ELO', () => {
    const tied = [player('low', 1, 1, 900), player('high', 1, 1, 1500)];
    expect(sortPlayers(tied, column('kd'), 'last10', 'desc').map((p) => p.playerId)).toEqual(['high', 'low']);
  });

  it('formats values with fixed decimals and thousands', () => {
    expect(formatValue(column('kd'), 1.234)).toBe('1.23');
    expect(formatValue(column('winRate'), 53.4)).toBe('53');
    expect(formatValue(column('elo'), 1602)).toBe('1,602');
    expect(formatValue(column('kd'), null)).toBe('—');
  });

  it('mutes rows with too few matches behind them', () => {
    const few = { ...player('few', 1, 1), form: { last10: summary(1, 4), last30: null, last100: null } } as SquadPlayer;
    expect(isLowSample(few, 'core', 'last10')).toBe(true);
    expect(isLowSample(players[0], 'core', 'last10')).toBe(false);
    expect(isLowSample(players[2], 'duels', 'last10')).toBe(true);
  });
});
