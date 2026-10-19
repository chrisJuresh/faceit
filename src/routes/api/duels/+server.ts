import { buildRecentDuels } from '$lib/server/duels';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// A cold read is one FACEIT request per match; each call reads for about 20 seconds and the page
// asks again for the rest.
export const config = { maxDuration: 30 };

export const GET: RequestHandler = async () => {
  try {
    return json(await buildRecentDuels(), { headers: { 'cache-control': 'private, no-store' } });
  } catch (cause) {
    console.error('Recent duels failed', cause);
    error(502, 'FACEIT data is unavailable.');
  }
};
