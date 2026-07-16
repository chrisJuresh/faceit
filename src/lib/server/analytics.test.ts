import { describe, expect, it } from 'vitest';
import { estimatedSwing, officialSwing, statNumber } from './analytics';
import type { FaceitStatsPlayer, FaceitStatsTeam } from './faceit';

const player = (
  playerId: string,
  adr: number,
  kills: number,
  deaths: number
): FaceitStatsPlayer => ({
  player_id: playerId,
  nickname: playerId,
  player_stats: {
    ADR: String(adr),
    Kills: String(kills),
    Deaths: String(deaths),
    Assists: '4',
    'K/D Ratio': String(kills / deaths),
    'K/R Ratio': String(kills / 20)
  }
});

describe('analytics helpers', () => {
  it('parses numeric FACEIT stats safely', () => {
    expect(statNumber({ Swing: '+3.42%' }, 'Swing')).toBe(3.42);
    expect(statNumber({ Missing: null }, 'Missing')).toBe(0);
  });

  it('prefers an official swing field when FACEIT exposes one', () => {
    expect(officialSwing({ 'Round Swing': '-1.8%' })).toBe(-1.8);
    expect(officialSwing({ ADR: '82' })).toBeNull();
  });

  it('scores stronger team-relative impact above weaker impact', () => {
    const strong = player('strong', 105, 24, 13);
    const average = player('average', 72, 14, 16);
    const weak = player('weak', 48, 8, 19);
    const team: FaceitStatsTeam = {
      team_id: 'team',
      team_stats: {},
      players: [strong, average, weak]
    };

    expect(estimatedSwing(strong, team, 20)).toBeGreaterThan(0);
    expect(estimatedSwing(weak, team, 20)).toBeLessThan(0);
  });
});
