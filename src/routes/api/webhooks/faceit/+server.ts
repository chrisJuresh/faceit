import { env } from '$env/dynamic/private';
import { safeEqual } from '$lib/server/auth';
import { recordWebhookEvent } from '$lib/server/live-registry';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 64 * 1024;

export const POST: RequestHandler = async ({ request }) => {
  const secret = env.FACEIT_WEBHOOK_SECRET?.trim();
  if (!secret) error(404, 'Not found');

  const headerName = (env.FACEIT_WEBHOOK_HEADER || 'x-webhook-secret').trim().toLowerCase();
  if (!safeEqual(request.headers.get(headerName) || '', secret)) error(401, 'Unauthorized');

  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    error(413, 'Payload too large');
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) error(413, 'Payload too large');

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    error(400, 'Invalid JSON');
  }

  const event = await recordWebhookEvent(body);
  return json({ accepted: Boolean(event) }, { status: event ? 200 : 202 });
};
