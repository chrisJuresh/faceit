import { json } from '@sveltejs/kit';

export const GET = () =>
  json(
    { ok: true, service: 'stackline', timestamp: new Date().toISOString() },
    { headers: { 'cache-control': 'no-store' } }
  );
