import { buildLongActivity } from '$lib/server/activity';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// A cold build walks every player's full CS2 history; give it room on Vercel.
export const config = { maxDuration: 30 };

export const GET: RequestHandler = async () => {
  try {
    return json(await buildLongActivity(), { headers: { 'cache-control': 'private, no-store' } });
  } catch (cause) {
    console.error('Long activity failed', cause);
    error(502, 'FACEIT data is unavailable.');
  }
};
