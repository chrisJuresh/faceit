import { afterEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string> = {};
vi.mock('$env/dynamic/private', () => ({ env }));

const { hashToObject, kvConfigured, redis } = await import('./kv');

afterEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  vi.unstubAllGlobals();
});

describe('kv', () => {
  it('is off until both URL and token are set', () => {
    expect(kvConfigured()).toBe(false);
    env.KV_REST_API_URL = 'https://example.upstash.io';
    expect(kvConfigured()).toBe(false);
    env.KV_REST_API_TOKEN = 'token';
    expect(kvConfigured()).toBe(true);
  });

  it('sends commands to the Upstash REST endpoint', async () => {
    env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io/';
    env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: 'OK' })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(redis('HSET', 'key', 'field', 'value')).resolves.toBe('OK');
    expect(fetchMock).toHaveBeenCalledWith('https://example.upstash.io', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(['HSET', 'key', 'field', 'value'])
    }));
  });

  it('surfaces Redis errors', async () => {
    env.KV_REST_API_URL = 'https://example.upstash.io';
    env.KV_REST_API_TOKEN = 'token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'WRONGTYPE' }), { status: 400 })));
    await expect(redis('HGETALL', 'key')).rejects.toThrow('WRONGTYPE');
  });

  it('turns HGETALL replies into objects', () => {
    expect(hashToObject(['a', '1', 'b', '2'])).toEqual({ a: '1', b: '2' });
    expect(hashToObject(null)).toEqual({});
  });
});
