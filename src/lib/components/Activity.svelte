<script lang="ts">
  import { shortDate } from '$lib/format';
  import type { SquadOverview, SquadPlayer } from '$lib/types';

  let {
    activity,
    players
  }: { activity: SquadOverview['activity']; players: Map<string, SquadPlayer> } = $props();

  const rows = $derived(
    activity.rows
      .map((row) => ({
        ...row,
        name: players.get(row.playerId)?.displayName ?? 'Unknown',
        total: row.counts.reduce((sum, count) => sum + count, 0)
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total)
  );
  const peak = $derived(Math.max(1, ...rows.flatMap((row) => row.counts)));
  const strength = (count: number) => (count ? 0.1 + 0.75 * Math.sqrt(count / peak) : 0);

  // Label the first week of each month.
  const monthLabels = $derived(
    activity.weekStarts.map((start, index) => {
      const month = new Date(start * 1000).getUTCMonth();
      const previous = index ? new Date(activity.weekStarts[index - 1] * 1000).getUTCMonth() : -1;
      return month !== previous
        ? new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(start * 1000))
        : '';
    })
  );
</script>

{#if rows.length}
  <div class="grid" style:--weeks={activity.weekStarts.length}>
    <span></span>
    {#each monthLabels as label, index (index)}<span class="month">{label}</span>{/each}
    <span class="month total">Total</span>

    {#each rows as row (row.playerId)}
      <span class="name">{row.name}</span>
      {#each row.counts as count, index (index)}
        {@const level = strength(count)}
        <span
          class="cell"
          class:strong={level > 0.5}
          style:background={count ? `rgb(var(--ink-rgb) / ${level.toFixed(3)})` : undefined}
          title="{row.name}: {count} {count === 1 ? 'match' : 'matches'}, week of {shortDate(activity.weekStarts[index])}"
        >{count || ''}</span>
      {/each}
      <span class="total">{row.total}</span>
    {/each}
  </div>
{:else}
  <p class="none">Nobody has played in the last {activity.weekStarts.length} weeks.</p>
{/if}

<style>
  .grid {
    align-items: center;
    display: grid;
    font-size: 12px;
    gap: 3px;
    grid-template-columns: minmax(84px, 116px) repeat(var(--weeks), minmax(0, 1fr)) 38px;
  }

  .name {
    overflow: hidden;
    padding-right: 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .month {
    color: var(--muted);
    font-size: 11px;
    height: 16px;
    overflow: visible;
    white-space: nowrap;
  }

  .cell {
    align-items: center;
    aspect-ratio: 1;
    background: var(--band);
    color: var(--ink);
    display: flex;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
    justify-content: center;
    min-height: 18px;
  }

  .cell.strong {
    color: var(--page);
  }

  .total {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .month.total {
    color: var(--muted);
  }
</style>
