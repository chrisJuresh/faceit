import { describe, expect, it } from 'vitest';
import { eloToNextLevel, levelForElo, levelVar } from './levels';

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

  it('maps levels to the theme-aware colour variables', () => {
    expect(levelVar(10)).toBe('var(--level-10)');
    expect(levelVar(7)).toBe('var(--level-4)');
    expect(levelVar(0)).toBe('var(--level-1)');
  });
});
