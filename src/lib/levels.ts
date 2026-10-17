/** Lowest ELO of each FACEIT CS2 skill level, level 1 first. */
export const LEVEL_FLOORS = [100, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001];

export function levelForElo(elo: number) {
  let level = 1;
  LEVEL_FLOORS.forEach((floor, index) => {
    if (elo >= floor) level = index + 1;
  });
  return level;
}

/** ELO still needed for the next level, or null at level 10. */
export function eloToNextLevel(elo: number) {
  const next = LEVEL_FLOORS[levelForElo(elo)];
  return next === undefined ? null : next - elo;
}

/** FACEIT's own skill-level colours. */
export function levelColor(level: number) {
  if (level >= 10) return '#fe1f00';
  if (level >= 8) return '#ff6309';
  if (level >= 4) return '#ffc800';
  if (level >= 2) return '#1ce400';
  return '#eeeeee';
}

/** The CSS variable for a level's colour; app.css darkens them for the light theme. */
export function levelVar(level: number) {
  if (level >= 10) return 'var(--level-10)';
  if (level >= 8) return 'var(--level-8)';
  if (level >= 4) return 'var(--level-4)';
  if (level >= 2) return 'var(--level-2)';
  return 'var(--level-1)';
}
