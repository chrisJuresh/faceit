import { buildLiveOverview } from '$lib/server/live';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    return json(await buildLiveOverview(), { headers: { 'cache-control': 'private, no-store' } });
  } catch (cause) {
    console.error('Live overview failed', cause);
    error(502, 'FACEIT data is unavailable.');
  }
};
