<script lang="ts" module>
  export type FormMetric = 'adr' | 'kd' | 'kills' | 'hs';
</script>

<script lang="ts">
  import { fixed, headshotRate, kd, score, shortDate } from '$lib/format';
  import { readout } from '$lib/tooltip.svelte';
  import type { PlayerMatch } from '$lib/types';

  /**
   * One bar per match, oldest on the left, coloured by result, with the run's average as a
   * hairline. Matches arrive newest first, as FACEIT returns them.
   */
  let { matches, metric }: { matches: PlayerMatch[]; metric: FormMetric } = $props();

  const HEIGHT = 136;
  const PAD = { top: 8, right: 58, bottom: 20, left: 30 };
  const LABEL: Record<FormMetric, string> = { adr: 'ADR', kd: 'K/D', kills: 'Kills', hs: 'Headshot %' };

  let width = $state(480);

  const series = $derived([...matches].reverse());
  const value = (match: PlayerMatch) =>
    metric === 'adr'
      ? match.adr
      : metric === 'kd'
        ? kd(match.kills, match.deaths)
        : metric === 'kills'
          ? match.kills
          : headshotRate(match.headshots, match.kills);
  const values = $derived(series.map(value));
  const peak = $derived(Math.max(0, ...values));
  const step = $derived(
    metric === 'adr' ? 50 : metric === 'kd' ? (peak <= 2 ? 0.5 : 1) : metric === 'kills' ? 10 : 50
  );
  const top = $derived(metric === 'hs' ? 100 : Math.max(step * 2, Math.ceil(peak / step) * step));
  const ticks = $derived(Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step));

  // Totals over the run, not an average of per-match ratios.
  const average = $derived.by(() => {
    const sum = (pick: (match: PlayerMatch) => number) => series.reduce((total, match) => total + pick(match), 0);
    if (!series.length) return 0;
    if (metric === 'adr') {
      const rounds = sum((match) => match.rounds);
      return rounds ? sum((match) => match.adr * match.rounds) / rounds : sum((match) => match.adr) / series.length;
    }
    if (metric === 'kd') return kd(sum((match) => match.kills), sum((match) => match.deaths));
    if (metric === 'kills') return sum((match) => match.kills) / series.length;
    const kills = sum((match) => match.kills);
    return kills ? (sum((match) => match.headshots) / kills) * 100 : 0;
  });

  const chartWidth = $derived(Math.max(260, Math.floor(width)));
  const plotWidth = $derived(chartWidth - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = $derived(plotWidth / Math.max(1, series.length));
  const barWidth = $derived(Math.max(3, Math.min(14, slot - 3)));
  const y = (amount: number) => PAD.top + plotHeight - (Math.min(amount, top) / top) * plotHeight;
  const format = (amount: number, digits = metric === 'kd' ? 2 : 1) => amount.toFixed(digits);
  const tickText = (tick: number) => (metric === 'kd' ? tick.toFixed(1) : String(tick));

  const describe = (match: PlayerMatch) => [
    `${shortDate(match.finishedAt)} · ${match.map}`,
    `${match.won ? 'Win' : 'Loss'} ${score(match.teamScore, match.enemyScore)}`,
    `${match.kills}–${match.deaths}–${match.assists} · K/D ${fixed(kd(match.kills, match.deaths), 2)}`,
    `ADR ${fixed(match.adr, 1)} · HS ${headshotRate(match.headshots, match.kills)}%`
  ];
</script>

<div class="chart" bind:clientWidth={width}>
  <svg
    width={chartWidth}
    height={HEIGHT}
    viewBox="0 0 {chartWidth} {HEIGHT}"
    role="img"
    aria-label="{LABEL[metric]} per match, last {series.length} matches, oldest to latest"
  >
    {#each ticks as tick (tick)}
      <line class="grid" x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} />
      <text class="axis" x={PAD.left - 6} y={y(tick) + 3} text-anchor="end">{tickText(tick)}</text>
    {/each}
    {#if metric === 'kd'}
      <line class="one" x1={PAD.left} x2={PAD.left + plotWidth} y1={y(1)} y2={y(1)} />
    {/if}
    {#each values as amount, index (index)}
      {@const height = Math.max(1, PAD.top + plotHeight - y(amount))}
      <rect
        class="bar"
        class:win={series[index].won}
        class:loss={!series[index].won}
        x={PAD.left + index * slot + (slot - barWidth) / 2}
        y={PAD.top + plotHeight - height}
        width={barWidth}
        {height}
        rx="1.5"
      />
    {/each}
    <line class="average" x1={PAD.left} x2={PAD.left + plotWidth + 4} y1={y(average)} y2={y(average)} />
    <text class="average-label" x={PAD.left + plotWidth + 8} y={y(average) + 3.5}>{format(average, metric === 'kd' ? 2 : 1)}</text>
    {#if series.length}
      <text class="axis" x={PAD.left} y={HEIGHT - 4}>{shortDate(series[0].finishedAt)}</text>
      <text class="axis" x={PAD.left + plotWidth} y={HEIGHT - 4} text-anchor="end">
        {shortDate(series[series.length - 1].finishedAt)}
      </text>
    {/if}
    {#each series as match, index (index)}
      <rect
        class="hit"
        x={PAD.left + index * slot}
        y={PAD.top}
        width={slot}
        height={plotHeight}
        role="presentation"
        {...readout(() => describe(match))}
      />
    {/each}
  </svg>
</div>

<style>
  .chart {
    min-width: 0;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .grid {
    shape-rendering: crispEdges;
    stroke: var(--rule);
  }

  .one {
    shape-rendering: crispEdges;
    stroke: var(--faint);
  }

  .axis {
    fill: var(--muted);
    font: 10.5px var(--mono);
  }

  .bar.win {
    fill: var(--win);
  }

  .bar.loss {
    fill: var(--loss);
  }

  .average {
    shape-rendering: crispEdges;
    stroke: var(--ink-2);
  }

  .average-label {
    fill: var(--ink-2);
    font: 10.5px var(--mono);
  }

  .hit {
    fill: transparent;
  }
</style>
