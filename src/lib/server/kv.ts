import { env } from '$env/dynamic/private';

// Minimal Upstash Redis REST client. Serverless hosts such as Vercel don't share memory or
// keep files between invocations, so webhook state and aliases live in Redis when it is
// configured. The Vercel Marketplace integration sets KV_REST_API_*; direct Upstash setups
// use UPSTASH_REDIS_REST_*. Without either, callers fall back to memory or local files.

type RedisValue = string | number | null | RedisValue[];

function credentials() {
  const url = (env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = (env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function kvConfigured() {
  return credentials() !== null;
}

export async function redis<T extends RedisValue = RedisValue>(...command: Array<string | number>) {
  const config = credentials();
  if (!config) throw new Error('Redis is not configured.');

  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  const body = (await response.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!response.ok || body.error) {
    throw new Error(`Redis ${command[0]} failed: ${body.error || response.status}`);
  }
  return body.result as T;
}

/** Converts an HGETALL reply ([field, value, field, value, ...]) into an object. */
export function hashToObject(reply: RedisValue): Record<string, string> {
  const result: Record<string, string> = {};
  if (!Array.isArray(reply)) return result;
  for (let index = 0; index + 1 < reply.length; index += 2) {
    result[String(reply[index])] = String(reply[index + 1]);
  }
  return result;
}
