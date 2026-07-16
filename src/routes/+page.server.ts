import { dev } from '$app/environment';
import { buildDashboard } from '$lib/server/dashboard';
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

const LOOKBACKS = [5, 10, 15, 25, 50, 100] as const;

export const load: PageServerLoad = async ({ url, cookies, depends, setHeaders }) => {
  depends('faceit:dashboard');
  setHeaders({ 'cache-control': 'private, no-store' });

  const requested = Number(url.searchParams.get('matches'));
  const lookback = LOOKBACKS.includes(requested as (typeof LOOKBACKS)[number]) ? requested : 15;

  try {
    const dashboard = await buildDashboard(lookback);
    return {
      dashboard,
      lookbacks: [...LOOKBACKS],
      isOwner: isOwner(cookies),
      ownerAccessConfigured: ownerAccessConfigured(),
      apiError: null
    };
  } catch (error) {
    console.error('Dashboard load failed', error);
    return {
      dashboard: null,
      lookbacks: [...LOOKBACKS],
      isOwner: isOwner(cookies),
      ownerAccessConfigured: ownerAccessConfigured(),
      apiError: 'FACEIT data is temporarily unavailable. Please retry in a moment.'
    };
  }
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
