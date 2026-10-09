import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'stackline_owner';
const SESSION_VALUE = 'owner';

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signature() {
  const secret = env.SESSION_SECRET || env.OWNER_ACCESS_TOKEN || '';
  if (!secret) return '';
  return createHmac('sha256', secret).update(SESSION_VALUE).digest('base64url');
}

export function ownerAccessConfigured() {
  return Boolean(env.OWNER_ACCESS_TOKEN && (env.SESSION_SECRET || env.OWNER_ACCESS_TOKEN));
}

export function verifyOwnerToken(token: string) {
  const configured = env.OWNER_ACCESS_TOKEN || '';
  return Boolean(configured && token && safeEqual(configured, token));
}

export function isOwner(cookies: Cookies) {
  const current = cookies.get(COOKIE_NAME) || '';
  const expected = signature();
  return Boolean(expected && safeEqual(current, expected));
}

export function setOwnerSession(cookies: Cookies, secure: boolean) {
  cookies.set(COOKIE_NAME, signature(), {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearOwnerSession(cookies: Cookies) {
  cookies.delete(COOKIE_NAME, { path: '/' });
}
