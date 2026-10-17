import { FaceitApiError } from '$lib/server/faceit';
import { buildMatchBoard, extractMatchId } from '$lib/server/live';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const matchId = extractMatchId(params.id);
  if (!matchId || matchId !== params.id.toLowerCase()) error(400, 'Invalid match id.');

  try {
    return json(await buildMatchBoard(matchId), {
      headers: { 'cache-control': 'private, max-age=60' }
    });
  } catch (cause) {
    if (cause instanceof FaceitApiError && cause.status === 404) error(404, 'Match not found.');
    console.error('Match board failed', cause);
    error(502, 'FACEIT data is unavailable.');
  }
};
