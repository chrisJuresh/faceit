import { describe, expect, it } from 'vitest';
import { ALL_COLUMNS, formatValue, sortPlayers } from './columns';
import type { SquadPlayer, Summary } from './types';

const column = (key: string) => ALL_COLUMNS.find((entry) => entry.key === key)!;

const summary = (kd: number): Summary => ({
  matches: 10,
  wins: 5,
  losses: 5,
  winRate: 50,
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

const player = (name: string, kd: number | null, lifetimeKd: number | null): SquadPlayer =>
  ({
    playerId: name,
    displayName: name,
    form: { last10: kd === null ? null : summary(kd), last30: null, last100: null },
    lifetime: lifetimeKd === null ? null : { kd: lifetimeKd, entrySuccess: 50 },
    regionRank: null
  }) as unknown as SquadPlayer;

describe('columns', () => {
  const players = [player('a', 1.1, 0.9), player('b', null, 1.3), player('c', 1.4, null)];

  it('reads the selected scope', () => {
    expect(column('kd').value(players[0], 'last10')).toBe(1.1);
    expect(column('kd').value(players[0], 'lifetime')).toBe(0.9);
  });

  it('has no per-match values for lifetime, nor lifetime-only values for recent scopes', () => {
    expect(column('mvps').value(players[0], 'lifetime')).toBeNull();
    expect(column('entrySuccess').value(players[0], 'last10')).toBe(50);
    expect(column('entrySuccess').value(players[2], 'last10')).toBeNull();
  });

  it('sorts both ways and keeps empty values last', () => {
    const kd = column('kd');
    expect(sortPlayers(players, kd, 'last10', 'desc').map((p) => p.playerId)).toEqual(['c', 'a', 'b']);
    expect(sortPlayers(players, kd, 'last10', 'asc').map((p) => p.playerId)).toEqual(['a', 'c', 'b']);
    expect(sortPlayers(players, kd, 'lifetime', 'desc').map((p) => p.playerId)).toEqual(['b', 'a', 'c']);
  });

  it('formats values with fixed decimals and suffixes', () => {
    expect(formatValue(column('kd'), 1.234)).toBe('1.23');
    expect(formatValue(column('winRate'), 53.4)).toBe('53%');
    expect(formatValue(column('regionRank'), 495184)).toBe('495,184');
    expect(formatValue(column('kd'), null)).toBe('—');
  });
});
