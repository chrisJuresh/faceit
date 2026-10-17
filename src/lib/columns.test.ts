import { describe, expect, it } from 'vitest';
import { DUELS, OVERVIEW, allColumns, formatValue, sortPlayers } from './columns';
import type { SquadPlayer, Summary } from './types';

const columns = [...allColumns(OVERVIEW), ...allColumns(DUELS)];
const column = (key: string) => columns.find((entry) => entry.key === key)!;

const summary = (kd: number): Summary => ({
  matches: 10,
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

const player = (name: string, kd: number | null, lifetimeKd: number | null): SquadPlayer =>
  ({
    playerId: name,
    displayName: name,
    elo: 1000,
    form: { last10: kd === null ? null : summary(kd), last30: null, last100: null },
    lifetime:
      lifetimeKd === null
        ? null
        : { kd: lifetimeKd, matches: 100, wins: 55, entrySuccess: 50, clutch1v1: 40, clutch1v1Count: 30, mvpsPerMatch: 2.5 }
  }) as unknown as SquadPlayer;

describe('columns', () => {
  const players = [player('a', 1.1, 0.9), player('b', null, 1.3), player('c', 1.4, null)];

  it('reads the selected scope', () => {
    expect(column('kd').value(players[0], 'last10')).toBe(1.1);
    expect(column('kd').value(players[0], 'lifetime')).toBe(0.9);
    expect(column('mvps').value(players[0], 'lifetime')).toBe(2.5);
  });

  it('shows a W–L record and sorts it by wins', () => {
    expect(column('record').text?.(players[0], 'last10')).toBe('6–4');
    expect(column('record').text?.(players[0], 'lifetime')).toBe('55–45');
    expect(column('record').value(players[0], 'last10')).toBe(6);
  });

  it('reads duel columns from the lifetime record with their sample size', () => {
    expect(column('entrySuccess').value(players[0], 'lifetime')).toBe(50);
    expect(column('clutch1v1').sample?.(players[0])).toBe(30);
    expect(column('entrySuccess').value(players[2], 'lifetime')).toBeNull();
  });

  it('sorts both ways and keeps empty values last', () => {
    const kd = column('kd');
    expect(sortPlayers(players, kd, 'last10', 'desc').map((p) => p.playerId)).toEqual(['c', 'a', 'b']);
    expect(sortPlayers(players, kd, 'last10', 'asc').map((p) => p.playerId)).toEqual(['a', 'c', 'b']);
    expect(sortPlayers(players, kd, 'lifetime', 'desc').map((p) => p.playerId)).toEqual(['b', 'a', 'c']);
  });

  it('formats values with fixed decimals and suffixes', () => {
    expect(formatValue(column('kd'), 1.234)).toBe('1.23');
    expect(formatValue(column('winRate'), 53.4)).toBe('53');
    expect(formatValue(column('elo'), 1602)).toBe('1,602');
    expect(formatValue(column('kd'), null)).toBe('—');
  });
});
