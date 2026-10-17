import { describe, expect, it } from 'vitest';
import { playerAnchor, playerFromHash, playerHash } from './anchors';

describe('anchors', () => {
  const players = [{ nickname: 'Zeus-99' }, { nickname: 'ropz' }];

  it('links a player by nickname', () => {
    expect(playerAnchor(players[0])).toBe('player-Zeus-99');
    expect(playerHash({ nickname: 'a b' })).toBe('#player-a%20b');
  });

  it('finds the player a fragment names, in any case', () => {
    expect(playerFromHash('#player-Zeus-99', players)).toBe(players[0]);
    expect(playerFromHash('#player-ROPZ', players)).toBe(players[1]);
    expect(playerFromHash(playerHash({ nickname: 'ropz' }), players)).toBe(players[1]);
  });

  it('ignores other fragments and unknown or malformed names', () => {
    expect(playerFromHash('#maps', players)).toBeNull();
    expect(playerFromHash('', players)).toBeNull();
    expect(playerFromHash('#player-nobody', players)).toBeNull();
    expect(playerFromHash('#player-%E0%A4%A', players)).toBeNull();
  });
});
