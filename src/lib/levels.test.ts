import { describe, expect, it } from 'vitest';
import { eloToNextLevel, levelColor, levelForElo } from './levels';

describe('levels', () => {
  it('maps ELO to FACEIT CS2 levels', () => {
    expect(levelForElo(572)).toBe(2);
    expect(levelForElo(1602)).toBe(8);
    expect(levelForElo(2001)).toBe(10);
    expect(levelForElo(2000)).toBe(9);
  });

  it('counts the ELO to the next level', () => {
    expect(eloToNextLevel(1602)).toBe(149);
    expect(eloToNextLevel(2400)).toBeNull();
  });

  it('uses FACEIT level colours', () => {
    expect(levelColor(10)).toBe('#fe1f00');
    expect(levelColor(7)).toBe('#ffc800');
  });
});
