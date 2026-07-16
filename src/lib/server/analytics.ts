import type { FaceitStatsPlayer, FaceitStatsTeam } from './faceit';

export const round = (value: number, precision = 1) => {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

export function statNumber(
  stats: Record<string, string | number | null> | undefined,
  ...keys: string[]
): number {
  if (!stats) return 0;
  for (const key of keys) {
    const raw = stats[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw.replace('%', '').trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

export function officialSwing(stats: Record<string, string | number | null>): number | null {
  const keys = ['Round Swing', 'Swing', 'Avg. Round Swing', 'Average Round Swing'];
  for (const key of keys) {
    if (!(key in stats)) continue;
    const value = statNumber(stats, key);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function impactIndex(player: FaceitStatsPlayer, rounds: number): number {
  const stats = player.player_stats;
  const safeRounds = Math.max(rounds, 1);
  const kills = statNumber(stats, 'Kills');
  const deaths = statNumber(stats, 'Deaths');
  const assists = statNumber(stats, 'Assists');
  const adr = statNumber(stats, 'ADR') || statNumber(stats, 'Damage') / safeRounds;
  const kr = statNumber(stats, 'K/R Ratio') || kills / safeRounds;
  const kd = statNumber(stats, 'K/D Ratio') || kills / Math.max(deaths, 1);
  const entryWins = statNumber(stats, 'Entry Wins');
  const entryCount = statNumber(stats, 'Entry Count');
  const entrySuccess = entryCount ? entryWins / entryCount : 0.5;
  const utilityPerRound =
    statNumber(stats, 'Utility Damage per Round in a Match') ||
    statNumber(stats, 'Utility Damage') / safeRounds;

  return (
    0.42 * (adr / 75) +
    0.23 * (kr / 0.7) +
    0.17 * kd +
    0.08 * (assists / safeRounds / 0.18) +
    0.06 * (entrySuccess / 0.5) +
    0.04 * (utilityPerRound / 6)
  );
}

export function estimatedSwing(
  player: FaceitStatsPlayer,
  team: FaceitStatsTeam,
  rounds: number
): number {
  const playerIndex = impactIndex(player, rounds);
  const teamIndexes = team.players.map((teammate) => impactIndex(teammate, rounds));
  const teamAverage =
    teamIndexes.reduce((sum, current) => sum + current, 0) / Math.max(teamIndexes.length, 1);
  if (!teamAverage) return 0;
  return round(Math.max(-12, Math.min(12, (playerIndex / teamAverage - 1) * 18)), 2);
}

export function findPlayerTeam(teams: FaceitStatsTeam[], playerId: string) {
  return teams.find((team) => team.players.some((player) => player.player_id === playerId));
}
