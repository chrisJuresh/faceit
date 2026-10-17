<script lang="ts">
  import { shortDate } from '$lib/format';
  import { readout } from '$lib/tooltip.svelte';
  import type { SquadOverview, SquadPlayer } from '$lib/types';

  /**
   * Matches per player per week, or per weekday over the same weeks; deeper accent for busier
   * cells.
   */
  let { activity, players }: { activity: SquadOverview['activity']; players: SquadPlayer[] } = $props();

  type View = 'weeks' | 'days';
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  let view = $state<View>('weeks');

  const byPlayer = $derived(new Map(activity.rows.map((row) => [row.playerId, row])));
  const rows = $derived(
    [...players]
      .sort((a, b) => b.elo - a.elo)
      .map((player) => {
        const row = byPlayer.get(player.playerId);
        const cells =
          view === 'weeks'
            ? (row?.counts ?? activity.weekStarts.map(() => 0))
            : (row?.weekdays ?? WEEKDAYS.map(() => 0));
        return { player, cells, total: cells.reduce((sum, count) => sum + count, 0) };
      })
  );
  const peak = $derived(Math.max(1, ...rows.flatMap((row) => row.cells)));
  const cellLabel = (index: number) =>
    view === 'weeks' ? `week of ${shortDate(activity.weekStarts[index])}` : WEEKDAY_NAMES[index];

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
    {#if view === 'weeks'}Matches per week{:else}Matches per day, last <span class="mono">{activity.weekStarts.length}</span> weeks{/if}
  </span>
  <div class="controls">
    <div class="seg" role="group" aria-label="Activity grouping">
      <button type="button" aria-pressed={view === 'weeks'} onclick={() => (view = 'weeks')}>Weeks</button>
      <button type="button" aria-pressed={view === 'days'} onclick={() => (view = 'days')}>Days</button>
    </div>
  </div>
</div>

{#if rows.length}
  <div class="scroll bleed">
    <table class="activity">
      <thead>
        <tr>
          <th class="stick"><span class="sr-only">Player</span></th>
          {#if view === 'weeks'}
            {#each activity.weekStarts as start, index (start)}
              <th scope="col">
                {#if index % 3 === 0 && index < activity.weekStarts.length - 2}
                  <span class="week" aria-hidden="true">{shortDate(start)}</span>
                {/if}
                <span class="sr-only">Week of {shortDate(start)}</span>
              </th>
            {/each}
          {:else}
            {#each WEEKDAYS as day, index (day)}
              <th scope="col">
                <span class="week" aria-hidden="true">{day}</span>
                <span class="sr-only">{WEEKDAY_NAMES[index]}</span>
              </th>
            {/each}
          {/if}
          <th class="total" scope="col">Total</th>
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
                  `${row.player.displayName} · ${cellLabel(index)}`,
                  plural(count)
                ])}
              >
                <span aria-hidden="true">{count || ''}</span><span class="sr-only">{plural(count)}</span>
              </td>
            {/each}
            <td class="total" class:zero={!row.total}>{row.total}</td>
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

  /* Fills its column: the weeks (or days) share the width, the name and total columns stay narrow. */
  .activity {
    border-collapse: separate;
    border-spacing: 2px;
    white-space: nowrap;
    width: 100%;
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
