<script lang="ts">
  import { monthYear, shortDate } from '$lib/format';
  import { readout } from '$lib/tooltip.svelte';
  import type { LongActivity, SquadOverview, SquadPlayer } from '$lib/types';

  /**
   * Matches per player per day, week, month or year; deeper accent for busier cells. Days and weeks
   * come with the page. Months and years need each player's full history, so they're fetched the
   * first time either is picked.
   */
  let { activity, players }: { activity: SquadOverview['activity']; players: SquadPlayer[] } = $props();

  type View = 'days' | 'weeks' | 'months' | 'years';
  type Column = { start: number; label: string; name: string };

  const VIEWS: Array<{ key: View; label: string; meta: string }> = [
    { key: 'days', label: 'Days', meta: 'Matches per day' },
    { key: 'weeks', label: 'Weeks', meta: 'Matches per week' },
    { key: 'months', label: 'Months', meta: 'Matches per month' },
    { key: 'years', label: 'Years', meta: 'Matches per year' }
  ];

  const utc = (options: Intl.DateTimeFormatOptions) => {
    const format = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' });
    return (timestamp: number) => format.format(new Date(timestamp * 1000));
  };
  const weekday = utc({ weekday: 'short' });
  const weekdayLong = utc({ weekday: 'long' });
  const month = utc({ month: 'short' });
  const year = utc({ year: 'numeric' });

  let view = $state<View>('weeks');
  let long = $state<LongActivity | null>(null);
  let longState = $state<'idle' | 'loading' | 'failed'>('idle');

  async function loadLong() {
    longState = 'loading';
    try {
      const response = await fetch('/api/activity');
      if (!response.ok) throw new Error(`Activity returned ${response.status}`);
      long = (await response.json()) as LongActivity;
      longState = 'idle';
    } catch {
      longState = 'failed';
    }
  }

  function choose(next: View) {
    view = next;
    if ((next === 'months' || next === 'years') && !long && longState !== 'loading') loadLong();
  }

  const meta = $derived(VIEWS.find((option) => option.key === view)?.meta ?? '');

  /** The view's columns and each player's counts, or null while months and years are loading. */
  const table = $derived.by(() => {
    if (view === 'days' || view === 'weeks') {
      const starts = view === 'days' ? activity.dayStarts : activity.weekStarts;
      const columns: Column[] = starts.map((start, index) =>
        view === 'days'
          ? { start, label: weekday(start), name: `${weekdayLong(start)} ${shortDate(start)}` }
          : {
              start,
              label: index % 3 === 0 && index < starts.length - 2 ? shortDate(start) : '',
              name: `Week of ${shortDate(start)}`
            }
      );
      const counts = new Map(activity.rows.map((row) => [row.playerId, view === 'days' ? row.days : row.weeks]));
      return { columns, counts };
    }
    if (!long) return null;
    const starts = view === 'months' ? long.monthStarts : long.yearStarts;
    const columns: Column[] = starts.map((start) =>
      view === 'months'
        ? { start, label: month(start), name: monthYear(start) }
        : { start, label: year(start), name: year(start) }
    );
    const counts = new Map(long.rows.map((row) => [row.playerId, view === 'months' ? row.months : row.years]));
    return { columns, counts };
  });

  const rows = $derived(
    table
      ? [...players]
          .sort((a, b) => b.elo - a.elo)
          .map((player) => {
            const cells = table.counts.get(player.playerId) ?? table.columns.map(() => 0);
            return { player, cells, total: cells.reduce((sum, count) => sum + count, 0) };
          })
      : []
  );
  const peak = $derived(Math.max(1, ...rows.flatMap((row) => row.cells)));

  /**
   * Five accent steps. The light three carry --ink and the deep two --on-accent, so the count
   * inside keeps 4.5:1 in both themes.
   */
  const STEPS = [
    { mix: 18, text: 'var(--ink)' },
    { mix: 32, text: 'var(--ink)' },
    { mix: 46, text: 'var(--ink)' },
    { mix: 80, text: 'var(--on-accent)' },
    { mix: 94, text: 'var(--on-accent)' }
  ];
  const step = (count: number) => STEPS[Math.max(0, Math.ceil(Math.sqrt(count / peak) * STEPS.length) - 1)];
  const plural = (count: number) => `${count} ${count === 1 ? 'match' : 'matches'}`;
</script>

<div class="section-head">
  <h2 id="activity-head">Activity</h2>
  <span class="meta">
    {meta}{#if view === 'days'}, last <span class="mono">{activity.dayStarts.length}</span> days{/if}
  </span>
  <div class="controls">
    <div class="seg" role="group" aria-label="Activity period">
      {#each VIEWS as option (option.key)}
        <button type="button" aria-pressed={view === option.key} onclick={() => choose(option.key)}
          >{option.label}</button
        >
      {/each}
    </div>
  </div>
</div>

{#if !table}
  {#if longState === 'failed'}
    <p class="none">FACEIT isn't responding</p>
    <button class="text-button" type="button" onclick={loadLong}>Try again</button>
  {:else}
    <p class="none">Reading every match…</p>
  {/if}
{:else if rows.length}
  <div class="scroll bleed">
    <table class="activity">
      <thead>
        <tr>
          <th class="stick"><span class="sr-only">Player</span></th>
          {#each table.columns as column (column.start)}
            <th class="period" scope="col">
              {#if column.label}
                <span class="week" aria-hidden="true">{column.label}</span>
              {/if}
              <span class="sr-only">{column.name}</span>
            </th>
          {/each}
          <th class="total" scope="col">Total</th>
          <td class="fill" aria-hidden="true"></td>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.player.playerId)}
          <tr>
            <th class="stick" scope="row">
              <span class="name" title={row.player.displayName}>{row.player.displayName}</span>
            </th>
            {#each row.cells as count, index (index)}
              {@const tone = count ? step(count) : null}
              <td
                style:background={tone ? `color-mix(in srgb, var(--accent) ${tone.mix}%, var(--cell))` : undefined}
                style:color={tone?.text}
                {...readout(() => [
                  `${row.player.displayName} · ${table.columns[index].name}`,
                  plural(count)
                ])}
              >
                <span aria-hidden="true">{count || ''}</span><span class="sr-only">{plural(count)}</span>
              </td>
            {/each}
            <td class="total" class:zero={!row.total}>{row.total}</td>
            <td class="fill" aria-hidden="true"></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="none">No players</p>
{/if}

<style>
  /* The wrapper bleeds by the cell spacing, so the outer cells line up with the column edges. */
  .bleed {
    margin: 0 -2px;
  }

  /*
   * Fills its column: the periods share the width up to 44px each, the name and total columns stay
   * narrow, and the trailing fill column takes whatever is left so a few years don't stretch wide.
   */
  .activity {
    border-collapse: separate;
    border-spacing: 2px;
    white-space: nowrap;
    width: 100%;
  }

  .period {
    width: 44px;
  }

  .fill {
    background: none;
    min-width: 0;
  }

  th {
    font-weight: 400;
    padding: 0;
  }

  thead th {
    height: 26px;
    position: relative;
  }

  .week {
    bottom: 5px;
    color: var(--muted);
    font: 10.5px var(--mono);
    left: 1px;
    position: absolute;
  }

  .stick {
    background: var(--surface);
    left: 0;
    position: sticky;
    text-align: left;
    width: 1%;
    z-index: 1;
  }

  /* Capped at the ladder's label width so the two charts' rows line up side by side. */
  .name {
    color: var(--ink-2);
    display: block;
    font-size: 12px;
    max-width: 112px;
    overflow: hidden;
    padding-right: 14px;
    text-overflow: ellipsis;
  }

  td {
    background: var(--cell);
    border-radius: 2px;
    font: 10.5px var(--mono);
    height: 26px;
    min-width: 26px;
    text-align: center;
  }

  .total {
    background: none;
    color: var(--ink-2);
    font: 12px var(--mono);
    padding-left: 10px;
    text-align: right;
    width: 1%;
  }

  .total.zero {
    color: var(--muted);
  }

  thead .total {
    color: var(--ink-2);
    font: 500 11.5px var(--sans);
  }

  @media (max-width: 640px) {
    .stick {
      box-shadow: inset -1px 0 var(--rule);
    }
  }
</style>
