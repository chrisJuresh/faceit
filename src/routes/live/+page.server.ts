import { buildLiveOverview, buildLookupMatch, extractMatchId } from '$lib/server/live';
import { FaceitApiError } from '$lib/server/faceit';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ url, depends, setHeaders }) => {
  depends('faceit:live');
  setHeaders({ 'cache-control': 'private, no-store' });

  const rawLookup = url.searchParams.get('match');
  const lookupId = extractMatchId(rawLookup);

  const [overview, lookup] = await Promise.all([
    buildLiveOverview().catch((error) => {
      console.error('Live overview failed', error);
      return null;
    }),
    lookupId
      ? buildLookupMatch(lookupId).catch((error) => {
          console.error('Match lookup failed', error);
          return error instanceof FaceitApiError && error.status === 404 ? 'not-found' : 'error';
        })
      : Promise.resolve(null)
  ]);

  return {
    overview,
    lookup: typeof lookup === 'object' ? lookup : null,
    lookupError: rawLookup
      ? !lookupId
        ? 'That does not look like a FACEIT match link or ID.'
        : lookup === 'not-found'
          ? 'FACEIT could not find that match.'
          : lookup === 'error'
            ? 'FACEIT could not load that match right now.'
            : null
      : null,
    apiError: overview ? null : 'FACEIT data is temporarily unavailable. Please retry in a moment.'
  };
};
