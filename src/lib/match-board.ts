import type { LiveMatch, LiveTeam } from './types';

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

/** The group's team first, then the other side. */
export function sides(match: LiveMatch) {
  const ours = match.teams.find((team) => team.tracked) ?? match.teams[0];
  const theirs = match.teams.find((team) => team !== ours);
  return { ours, theirs, teams: [ours, theirs].filter((team): team is LiveTeam => Boolean(team)) };
}

/** FACEIT names queue teams "team_<captain>". */
export const teamName = (team: LiveTeam) => team.name.replace(/^team_/, '');
