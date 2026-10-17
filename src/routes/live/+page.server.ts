import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Live matches are part of the main page now.
export const load: PageServerLoad = () => {
  redirect(308, '/');
};
