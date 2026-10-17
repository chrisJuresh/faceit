import { afterEach, describe, expect, it, vi } from 'vitest';
import { cached } from './cache';

afterEach(() => {
  vi.useRealTimers();
});

describe('cached', () => {
  it('reuses a fresh value', async () => {
    const factory = vi.fn().mockResolvedValue('a');
    await cached('fresh', 1000, factory);
    expect(await cached('fresh', 1000, factory)).toBe('a');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('serves a stale value while one background refresh replaces it', async () => {
    vi.useFakeTimers();
    const factory = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    await cached('stale', 1000, factory, 5000);

    vi.advanceTimersByTime(2000);
    const first = cached('stale', 1000, factory, 5000);
    const second = cached('stale', 1000, factory, 5000);
    expect(await first).toBe('old');
    expect(await second).toBe('old');
    expect(factory).toHaveBeenCalledTimes(2);

    await vi.waitFor(async () => expect(await cached('stale', 1000, factory, 5000)).toBe('new'));
  });

  it('refetches once the stale window has passed', async () => {
    vi.useFakeTimers();
    const factory = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    await cached('expired', 1000, factory, 1000);
    vi.advanceTimersByTime(5000);
    expect(await cached('expired', 1000, factory, 1000)).toBe('new');
  });

  it('forgets failures so the next call retries', async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('up');
    await expect(cached('failing', 1000, factory)).rejects.toThrow('down');
    expect(await cached('failing', 1000, factory)).toBe('up');
  });
});
