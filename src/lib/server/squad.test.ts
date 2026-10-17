import { describe, expect, it, vi } from 'vitest';
import type { FaceitLifetimeStats } from './faceit';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { parseLifetime, parseMaps, parsePlayerMatch } = await import('./squad');

// Shape and values copied from a real /players/{id}/games/cs2/stats item.
const item = (overrides: Record<string, string | number> = {}) => ({
  stats: {
    Result: '1',
    'Match Id': '1-82f2d36a-d741-447c-bdba-a3336d2a5172',
    'K/D Ratio': '1.58',
    MVPs: '8',
    'Headshots %': '32',
    'Game Mode': '5v5',
    Assists: '7',
    'Double Kills': '8',
    ADR: '93.7',
    Kills: '41',
    'Match Round': '1',
    'Triple Kills': '2',
    Map: 'de_mirage',
    'Final Score': '22',
    Damage: '3747',
    'Quadro Kills': '0',
    Headshots: '13',
    Score: '18 / 22',
    'Penta Kills': '0',
    Rounds: '40',
    'Match Finished At': 1791841726000,
    Team: 'team_Christian976',
    Deaths: '26',
    ...overrides
  }
});

describe('parsePlayerMatch', () => {
  it('reads a won match with the score from our side', () => {
    expect(parsePlayerMatch(item())).toMatchObject({
      matchId: '1-82f2d36a-d741-447c-bdba-a3336d2a5172',
      finishedAt: 1791841726,
      map: 'Mirage',
      won: true,
      teamScore: 22,
      enemyScore: 18,
      rounds: 40,
      kills: 41,
      deaths: 26,
      headshots: 13,
      damage: 3747,
      adr: 93.7,
      team: 'team_Christian976'
    });
  });

  it('reads a lost match', () => {
    const lost = parsePlayerMatch(item({ Result: '0', 'Final Score': '9', Score: '13 / 9' }));
    expect(lost).toMatchObject({ won: false, teamScore: 9, enemyScore: 13 });
  });

  it('skips wingman and other non-5v5 modes', () => {
    expect(parsePlayerMatch(item({ 'Game Mode': '2v2' }))).toBeNull();
  });

  it('leaves the enemy score empty when the score text is unusable', () => {
    expect(parsePlayerMatch(item({ Score: '' }))?.enemyScore).toBeNull();
  });
});

const lifetime: FaceitLifetimeStats = {
  player_id: 'p',
  lifetime: {
    Matches: '173',
    Wins: '92',
    'Win Rate %': '53',
    'K/D Ratio': '207.27',
    'Average K/D Ratio': '1.2',
    ADR: '84.14',
    'Total Headshots %': '7174',
    'Average Headshots %': '41',
    'Entry Rate': '0.16',
    'Entry Success Rate': '0.56',
    '1v1 Win Rate': '0.37',
    'Total 1v1 Count': '75',
    'Total Sniper Kills': '11',
    'Total Kills with extended stats': '2075',
    'Utility Damage per Round': '4.29',
    'Recent Results': ['1', '0', '1']
  },
  segments: [
    {
      label: 'Mirage',
      mode: '5v5',
      type: 'Map',
      img_regular: 'https://cdn.example/mirage.jpg',
      stats: { Matches: '39', Wins: '24', 'Win Rate %': '62', Kills: '800', Rounds: '900', 'Entry Success Rate': '0.5' }
    },
    {
      label: 'Inferno',
      mode: 'Wingman',
      type: 'Map',
      stats: { Matches: '4', Kills: '50', Rounds: '60' }
    },
    {
      label: 'Dust2',
      mode: '5v5',
      type: 'Map',
      stats: { Matches: '16', Kills: '300', Rounds: '400' }
    }
  ]
};

describe('parseMaps', () => {
  it('keeps 5v5 maps only, most played first', () => {
    const maps = parseMaps(lifetime);
    expect(maps.map((map) => map.map)).toEqual(['Mirage', 'Dust2']);
    expect(maps[0]).toMatchObject({ matches: 39, winRate: 62, entrySuccess: 50, image: 'https://cdn.example/mirage.jpg' });
  });

  it('names maps the way per-match stats do, so recent and lifetime records line up', () => {
    const names = parseMaps(lifetime).map((map) => map.map);
    expect(names).toContain(parsePlayerMatch(item())?.map);
    expect(names).toContain(parsePlayerMatch(item({ Map: 'de_dust2' }))?.map);
  });
});

describe('parseLifetime', () => {
  it('uses the averaged K/D and headshot fields, not the running sums', () => {
    const life = parseLifetime(lifetime, parseMaps(lifetime))!;
    expect(life.kd).toBe(1.2);
    expect(life.headshots).toBe(41);
  });

  it('converts FACEIT ratios to percentages and derives K/R and sniper share', () => {
    const life = parseLifetime(lifetime, parseMaps(lifetime))!;
    expect(life.entryRate).toBe(16);
    expect(life.entrySuccess).toBe(56);
    expect(life.clutch1v1).toBe(37);
    expect(life.kr).toBe(round2(1100 / 1300));
    expect(life.sniperKillShare).toBe(0.5);
    expect(life.recentResults).toEqual(['W', 'L', 'W']);
  });

  it('reports missing stats as null rather than zero', () => {
    const life = parseLifetime(lifetime, [])!;
    expect(life.flashSuccess).toBeNull();
    expect(life.kr).toBeNull();
  });

  it('returns null for players without a lifetime record', () => {
    expect(parseLifetime(null, [])).toBeNull();
  });
});

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
