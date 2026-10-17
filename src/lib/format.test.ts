import { describe, expect, it } from 'vitest';
import { age, aroundOne, clockUtc, stopwatch, timeAgo } from './format';

describe('format', () => {
  it('colours K/D by the value as shown', () => {
    expect(aroundOne(0.996)).toBe('pos');
    expect(aroundOne(0.994)).toBe('neg');
    expect(aroundOne(1.4)).toBe('pos');
    expect(aroundOne(null)).toBe('');
  });

  it('writes compact ages, and "ago" only in sentences', () => {
    const now = 1_790_000_000;
    expect(age(now - 30, now)).toBe('now');
    expect(age(now - 4 * 86_400, now)).toBe('4d');
    expect(timeAgo(now - 4 * 86_400, now)).toBe('4d ago');
    expect(age(null, now)).toBe('—');
  });

  it('writes clock times in UTC and running clocks past the hour', () => {
    expect(clockUtc(Date.UTC(2026, 9, 17, 19, 42) / 1000)).toBe('19:42 UTC');
    expect(stopwatch(25 * 60 + 13)).toBe('25:13');
    expect(stopwatch(3913)).toBe('1:05:13');
  });
});
