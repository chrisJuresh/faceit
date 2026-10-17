import type { LiveMatch } from './types';

const boards = new Map<string, Promise<LiveMatch>>();

/** Fetches the full board for a finished match once per page load. */
export function loadBoard(matchId: string): Promise<LiveMatch> {
  let board = boards.get(matchId);
  if (!board) {
    board = fetch(`/api/match/${encodeURIComponent(matchId)}`).then((response) => {
      if (!response.ok) throw new Error(`FACEIT returned ${response.status}`);
      return response.json() as Promise<LiveMatch>;
    });
    board.catch(() => boards.delete(matchId));
    boards.set(matchId, board);
  }
  return board;
}
