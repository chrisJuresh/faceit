import { describe, expect, it, vi } from 'vitest';
import type { FaceitMatch, FaceitMatchStats } from './faceit';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { buildLiveMatch, extractMatchId, matchPhase } = await import('./live');
const { parseWebhookEvent, partitionEntries, recordWebhookEvent, webhookMatches, clearWebhookMatches } =
  await import(
  './live-registry'
);

const MATCH_ID = '1-0a1b2c3d-1111-2222-3333-444455556666';
const roster = (prefix: string) =>
  Array.from({ length: 5 }, (_, index) => ({
    player_id: `${prefix}-${index}`,
    nickname: `${prefix}${index}`,
    game_skill_level: 5 + index
  }));

const baseMatch = (status: string): FaceitMatch => ({
  match_id: MATCH_ID,
  status,
  region: 'EU',
  competition_name: 'Europe 5v5 Queue',
  best_of: 1,
  calculate_elo: true,
  started_at: 1_700_000_000,
  faceit_url: `https://www.faceit.com/{lang}/cs2/room/${MATCH_ID}`,
  teams: {
    faction1: { faction_id: 'f1', name: 'team_a', leader: 'a-0', roster: roster('a'), stats: { winProbability: 0.54 } },
    faction2: { faction_id: 'f2', name: 'team_b', roster: roster('b'), stats: { winProbability: 0.46 } }
  },
  voting: {
    map: {
      pick: ['de_mirage'],
      entities: [{ class_name: 'de_mirage', name: 'Mirage', image_lg: 'https://cdn.example/mirage.jpg' }]
    },
    location: { pick: ['Frankfurt'], entities: [{ name: 'Frankfurt', class_name: 'Frankfurt' }] }
  }
});

const context = {
  ownerId: 'a-0',
  friendIds: new Set(['a-1']),
  source: 'history' as const,
  profiles: new Map(),
  lifetimes: new Map([
    [
      'a-0',
      {
        player_id: 'a-0',
        lifetime: {
          Matches: '171',
          'Win Rate %': '53',
          'Average K/D Ratio': '1.18',
          'Entry Success Rate': '0.56',
          'Recent Results': ['1', '0']
        },
        segments: [
          {
            label: 'Mirage',
            type: 'Map',
            mode: '5v5',
            stats: { Matches: '20', 'Win Rate %': '60', 'Average K/D Ratio': '1.3', ADR: '88' }
          }
        ]
      }
    ]
  ]),
  stats: null,
  aliases: { 'a-1': 'Buddy' }
};

describe('extractMatchId', () => {
  it('pulls the id out of a match room link', () => {
    expect(extractMatchId(`https://www.faceit.com/en/cs2/room/${MATCH_ID}/scoreboard`)).toBe(MATCH_ID);
  });

  it('rejects text without a match id', () => {
    expect(extractMatchId('not a match')).toBeNull();
    expect(extractMatchId(null)).toBeNull();
  });
});

describe('matchPhase', () => {
  it('maps FACEIT statuses to board phases', () => {
    expect(matchPhase('ONGOING')).toBe('live');
    expect(matchPhase('READY')).toBe('setup');
    expect(matchPhase('VOTING')).toBe('setup');
    expect(matchPhase('FINISHED')).toBe('finished');
    expect(matchPhase('finished')).toBe('finished');
    expect(matchPhase('CANCELLED')).toBe('cancelled');
  });
});

describe('buildLiveMatch', () => {
  it('builds a pre-result board with map, tracked players and lifetime context', () => {
    const board = buildLiveMatch(baseMatch('ONGOING'), context);
    expect(board.phase).toBe('live');
    expect(board.map?.name).toBe('Mirage');
    expect(board.location?.name).toBe('Frankfurt');
    expect(board.faceitUrl).toContain('/en/cs2/room/');
    expect(board.trackedPlayerIds).toEqual(['a-0', 'a-1']);
    expect(board.teams[0].winProbability).toBe(54);
    expect(board.teams[0].score).toBeNull();

    const owner = board.teams[0].players[0];
    expect(owner.isOwner).toBe(true);
    expect(owner.isLeader).toBe(true);
    expect(owner.lifetime?.entrySuccess).toBe(56);
    expect(owner.lifetime?.recentResults).toEqual(['W', 'L']);
    expect(owner.onMap).toMatchObject({ matches: 20, winRate: 60, adr: 88 });
    expect(board.teams[0].players[1].displayName).toBe('Buddy');
  });

  it('adds the full stat sheet once the match is finished', () => {
    const stats: FaceitMatchStats = {
      rounds: [
        {
          match_id: MATCH_ID,
          round_stats: { Map: 'de_mirage', Rounds: '22' },
          teams: [
            {
              team_id: 'f1',
              team_stats: { 'Final Score': '13', 'First Half Score': '7', 'Second Half Score': '6', 'Overtime score': '0' },
              players: roster('a').map((player, index) => ({
                player_id: player.player_id,
                nickname: player.nickname,
                player_stats: { Kills: String(10 + index), Deaths: '15', ADR: String(70 + index), MVPs: '2', 'Zeus Kills': '0' }
              }))
            },
            {
              team_id: 'f2',
              team_stats: { 'Final Score': '9', 'First Half Score': '5', 'Second Half Score': '4', 'Overtime score': '0' },
              players: roster('b').map((player) => ({
                player_id: player.player_id,
                nickname: player.nickname,
                player_stats: { Kills: '12', Deaths: '14', ADR: '75' }
              }))
            }
          ]
        }
      ]
    };

    const match = { ...baseMatch('FINISHED'), results: { winner: 'faction1', score: { faction1: 13, faction2: 9 } } };
    const board = buildLiveMatch(match, { ...context, stats });

    expect(board.rounds).toBe(22);
    expect(board.teams[0]).toMatchObject({ score: 13, won: true, firstHalf: 7, secondHalf: 6 });
    expect(board.teams[1].won).toBe(false);
    expect(board.teams[0].players[0].scoreline?.kills).toBe(14);
    expect(board.teams[0].players[0].allStats.map((stat) => stat.label)).toContain('Zeus Kills');
  });

  it('drops image URLs that could break out of an inline style', () => {
    const match = baseMatch('ONGOING');
    const vote = match.voting!.map as { entities: Array<{ image_lg?: string }> };
    vote.entities[0].image_lg = "https://cdn.example/x.jpg');background:url('evil";
    expect(buildLiveMatch(match, context).map?.image).toBe('');
  });
});

describe('webhook registry', () => {
  const payload = {
    event: 'match_status_ready',
    payload: { id: MATCH_ID, teams: [{ roster: [{ id: 'a-0-player' }, { id: 'a-1-player' }] }] }
  };

  it('parses match events and their rosters', () => {
    expect(parseWebhookEvent(payload, 1)).toEqual({
      matchId: MATCH_ID,
      event: 'match_status_ready',
      playerIds: ['a-0-player', 'a-1-player'],
      receivedAt: 1
    });
  });

  it('ignores malformed or non-match events', () => {
    expect(parseWebhookEvent({ event: 'hub_user_added', payload: { id: MATCH_ID } })).toBeNull();
    expect(parseWebhookEvent({ event: 'match_status_ready', payload: { id: '<script>' } })).toBeNull();
    expect(parseWebhookEvent('nope')).toBeNull();
  });

  it('keeps the roster across events and expires finished matches', async () => {
    clearWebhookMatches();
    await recordWebhookEvent(payload, 0);
    await recordWebhookEvent({ event: 'match_status_finished', payload: { id: MATCH_ID } }, 1000);
    expect((await webhookMatches(2000))[0].playerIds).toEqual(['a-0-player', 'a-1-player']);
    expect(await webhookMatches(1000 + 61 * 60_000)).toHaveLength(0);
  });

  it('keeps in-progress matches longer than finished ones', () => {
    const ready = { matchId: 'match-ready-1', event: 'match_status_ready', playerIds: [], receivedAt: 0 };
    const done = { matchId: 'match-done-1', event: 'match_status_finished', playerIds: [], receivedAt: 0 };
    const { keep, drop } = partitionEntries([ready, done], 90 * 60_000);
    expect(keep.map((entry) => entry.matchId)).toEqual(['match-ready-1']);
    expect(drop).toEqual(['match-done-1']);
  });
});
