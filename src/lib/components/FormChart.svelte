<script lang="ts">
  import { resultText, shortDate } from '$lib/format';
  import type { PlayerMatch } from '$lib/types';

  /** Matches newest first, as FACEIT returns them; drawn oldest to newest. */
  let { matches, metric = 'adr' }: { matches: PlayerMatch[]; metric?: 'adr' | 'kd' } = $props();

  const HEIGHT = 168;
  const PAD = { top: 14, right: 4, bottom: 22, left: 30 };

  let width = $state(420);
  let hovered = $state<number | null>(null);

  const series = $derived([...matches].reverse());
  const values = $derived(
    series.map((match) =>
      metric === 'adr' ? match.adr : match.deaths ? match.kills / match.deaths : match.kills
    )
  );
  const top = $derived(
    metric === 'adr'
      ? Math.max(150, Math.ceil(Math.max(...values) / 50) * 50)
      : Math.max(2.5, Math.ceil(Math.max(...values) * 2) / 2)
  );
  const ticks = $derived(metric === 'adr' ? [0, top / 2, top] : [0, 1, top]);
  // Totals, not an average of per-match ratios.
  const reference = $derived.by(() => {
    if (metric === 'adr') {
      const rounds = series.reduce((sum, match) => sum + match.rounds, 0);
      return rounds ? series.reduce((sum, match) => sum + match.adr * match.rounds, 0) / rounds : 0;
    }
    const deaths = series.reduce((sum, match) => sum + match.deaths, 0);
    const kills = series.reduce((sum, match) => sum + match.kills, 0);
    return deaths ? kills / deaths : kills;
  });

  const plotWidth = $derived(Math.max(60, width - PAD.left - PAD.right));
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = $derived(plotWidth / Math.max(1, series.length));
  const barWidth = $derived(Math.max(2, Math.min(18, slot - 2)));
  const y = (value: number) => PAD.top + plotHeight - (Math.min(value, top) / top) * plotHeight;

  /** A column with a rounded data end and a square foot on the baseline. */
  function column(index: number, value: number) {
    const x = PAD.left + index * slot + (slot - barWidth) / 2;
    const base = PAD.top + plotHeight;
    const yTop = Math.min(y(value), base - 1);
    const r = Math.min(2, barWidth / 2, base - yTop);
    return `M${x},${base}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + barWidth - r}Q${x + barWidth},${yTop} ${x + barWidth},${yTop + r}V${base}Z`;
  }

  const format = (value: number) => (metric === 'adr' ? value.toFixed(0) : value.toFixed(2));
  const active = $derived(hovered === null ? null : series[hovered]);
</script>

<figure class="form" bind:clientWidth={width}>
  <svg {width} height={HEIGHT} role="img" aria-label="{metric === 'adr' ? 'ADR' : 'K/D'} per match, oldest to newest">
    {#each ticks as tick (tick)}
      <line class="grid" x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} />
      <text class="tick" x={PAD.left - 6} y={y(tick)} dominant-baseline="middle" text-anchor="end">{format(tick)}</text>
    {/each}
    {#each values as value, index (index)}
      <path
        d={column(index, value)}
        class:win={series[index].won}
        class:loss={!series[index].won}
        class:dim={hovered !== null && hovered !== index}
      />
    {/each}
    <line class="reference" x1={PAD.left} x2={PAD.left + plotWidth} y1={y(reference)} y2={y(reference)} />
    <text class="ref-label" x={PAD.left + plotWidth} y={y(reference) - 5} text-anchor="end">
      {series.length}-match {metric === 'adr' ? 'ADR' : 'K/D'} {format(reference)}
    </text>
    {#if series.length}
      <text class="tick" x={PAD.left} y={HEIGHT - 6}>{shortDate(series[0].finishedAt)}</text>
      <text class="tick" x={PAD.left + plotWidth} y={HEIGHT - 6} text-anchor="end">
        {shortDate(series[series.length - 1].finishedAt)}
      </text>
    {/if}
    {#each series as match, index (match.matchId)}
      <rect
        class="hit"
        x={PAD.left + index * slot}
        y={PAD.top}
        width={slot}
        height={plotHeight}
        role="presentation"
        onpointerenter={() => (hovered = index)}
        onpointerleave={() => (hovered = null)}
      />
    {/each}
  </svg>
  <figcaption>
    {#if active}
      <span>{shortDate(active.finishedAt)} · {active.map}</span>
      <span class="res" class:win={active.won} class:loss={!active.won}>
        {resultText(active.won, active.teamScore, active.enemyScore)}
      </span>
      <span>{active.kills}–{active.deaths}–{active.assists}</span>
      <span>{active.adr.toFixed(1)} ADR</span>
    {:else}
      <span class="key"><i class="win"></i>Won</span>
      <span class="key"><i class="loss"></i>Lost</span>
    {/if}
  </figcaption>
</figure>

<style>
  .form {
    margin: 0;
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

  .tick {
    fill: var(--muted);
    font: 11px var(--sans);
    font-variant-numeric: tabular-nums;
  }

  path.win {
    fill: var(--win);
  }

  path.loss {
    fill: var(--loss);
  }

  path.dim {
    opacity: 0.35;
  }

  .reference {
    shape-rendering: crispEdges;
    stroke: var(--ink-2);
  }

  .ref-label {
    fill: var(--ink);
    font: 12px var(--sans);
    font-variant-numeric: tabular-nums;
    paint-order: stroke;
    stroke: var(--page);
    stroke-linejoin: round;
    stroke-width: 4px;
  }

  .hit {
    fill: transparent;
  }

  figcaption {
    color: var(--ink-2);
    display: flex;
    flex-wrap: wrap;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    gap: 4px 14px;
    margin-top: 4px;
    min-height: 18px;
  }

  .key i {
    display: inline-block;
    height: 8px;
    margin-right: 5px;
    width: 8px;
  }

  .key i.win {
    background: var(--win);
  }

  .key i.loss {
    background: var(--loss);
  }
</style>
