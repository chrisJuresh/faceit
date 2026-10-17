<script lang="ts">
  import { LEVEL_FLOORS, levelVar } from '$lib/levels';

  /** The ring fills with progress through the level when the ELO is known. */
  let { level, elo = 0, size = 20 }: { level: number; elo?: number; size?: number } = $props();

  const radius = 8.25;
  const circumference = 2 * Math.PI * radius;
  const progress = $derived.by(() => {
    if (!elo || !level) return 1;
    const floor = LEVEL_FLOORS[level - 1];
    const next = LEVEL_FLOORS[level];
    if (floor === undefined || next === undefined) return 1;
    return Math.min(1, Math.max(0.06, (elo - floor) / (next - floor)));
  });
</script>

<svg
  class="level"
  width={size}
  height={size}
  viewBox="0 0 20 20"
  role="img"
  aria-label="Level {level || 'unknown'}"
>
  <circle class="track" cx="10" cy="10" r={radius} />
  <circle
    class="arc"
    cx="10"
    cy="10"
    r={radius}
    style:stroke={levelVar(level)}
    stroke-dasharray="{circumference * progress} {circumference}"
    transform="rotate(-90 10 10)"
  />
  <text x="10" y="10.5" dominant-baseline="middle" text-anchor="middle">{level || '–'}</text>
</svg>

<style>
  .level {
    display: block;
    flex: none;
  }

  .track {
    fill: none;
    stroke: var(--rule-2);
    stroke-width: 2;
  }

  .arc {
    fill: none;
    stroke-linecap: round;
    stroke-width: 2;
  }

  text {
    fill: var(--ink);
    font: 600 9px var(--sans);
  }
</style>
