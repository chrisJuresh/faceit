import type { SquadPlayer } from './types';

const PREFIX = 'player-';

/** The id of a player's row, and the fragment that links to it: `#player-<nickname>`. */
export const playerAnchor = (player: Pick<SquadPlayer, 'nickname'>) => PREFIX + player.nickname;

export const playerHash = (player: Pick<SquadPlayer, 'nickname'>) =>
  '#' + PREFIX + encodeURIComponent(player.nickname);

/** The player a `#player-<nickname>` fragment names, matching the nickname in any case. */
export function playerFromHash<T extends Pick<SquadPlayer, 'nickname'>>(hash: string, players: T[]) {
  if (!hash.startsWith('#' + PREFIX)) return null;
  let nickname: string;
  try {
    nickname = decodeURIComponent(hash.slice(PREFIX.length + 1)).toLowerCase();
  } catch {
    return null;
  }
  return players.find((player) => player.nickname.toLowerCase() === nickname) ?? null;
}
