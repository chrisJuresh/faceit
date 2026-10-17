import { dev } from '$app/environment';
import { buildLiveOverview } from '$lib/server/live';
import { buildSquad } from '$lib/server/squad';
import {
  clearOwnerSession,
  isOwner,
  ownerAccessConfigured,
  setOwnerSession,
  verifyOwnerToken
} from '$lib/server/auth';
import { setAlias } from '$lib/server/aliases';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies, depends, setHeaders }) => {
  depends('faceit:squad');
  setHeaders({ 'cache-control': 'private, no-store' });

  const [squad, live] = await Promise.all([
    buildSquad().catch((error) => {
      console.error('Squad load failed', error);
      return null;
    }),
    buildLiveOverview().catch((error) => {
      console.error('Live overview failed', error);
      return null;
    })
  ]);

  return {
    squad,
    live,
    isOwner: isOwner(cookies),
    ownerAccessConfigured: ownerAccessConfigured()
  };
};

export const actions: Actions = {
  unlock: async ({ request, cookies, url }) => {
    if (!ownerAccessConfigured()) {
      return fail(503, { ownerError: 'Owner access has not been configured on the server.' });
    }

    const form = await request.formData();
    const token = String(form.get('token') || '');
    if (!verifyOwnerToken(token)) return fail(400, { ownerError: 'That access key is not valid.' });

    setOwnerSession(cookies, !dev && url.protocol === 'https:');
    return { ownerUnlocked: true };
  },

  rename: async ({ request, cookies }) => {
    if (!isOwner(cookies)) return fail(403, { renameError: 'Owner access is required.' });

    const form = await request.formData();
    const playerId = String(form.get('playerId') || '').trim();
    const alias = String(form.get('alias') || '').trim();

    if (!/^[a-f0-9-]{36}$/i.test(playerId)) {
      return fail(400, { renameError: 'The player identifier is invalid.' });
    }
    if (alias.length > 32) return fail(400, { renameError: 'Aliases can be up to 32 characters.' });

    await setAlias(playerId, alias);
    return { renamed: true };
  },

  logout: async ({ cookies }) => {
    clearOwnerSession(cookies);
    return { loggedOut: true };
  }
};
