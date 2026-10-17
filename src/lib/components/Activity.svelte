<script lang="ts">
  import { shortDate } from '$lib/format';
  import type { SquadOverview, SquadPlayer } from '$lib/types';

  /** Matches per player per week; deeper accent for busier weeks. */
  let { activity, players }: { activity: SquadOverview['activity']; players: SquadPlayer[] } = $props();

  const counts = $derived(new Map(activity.rows.map((row) => [row.playerId, row.counts])));
  const rows = $derived(
    [...players]
      .sort((a, b) => b.elo - a.elo)
      .map((player) => {
        const weeks = counts.get(player.playerId) ?? activity.weekStarts.map(() => 0);
        return { player, weeks, total: weeks.reduce((sum, count) => sum + count, 0) };
      })
  );
  const peak = $derived(Math.max(1, ...rows.flatMap((row) => row.weeks)));
  // Capped so the count inside stays readable in both themes.
  const tint = (count: number) =>
    `color-mix(in srgb, var(--accent) ${Math.round(12 + Math.sqrt(count / peak) * 36)}%, var(--cell))`;
</script>

{#if rows.length}
  <div class="scroll">
    <table class="activity">
      <thead>
        <tr>
          <th class="stick"><span class="sr-only">Player</span></th>
          {#each activity.weekStarts as start, index (start)}
            <th scope="col">
              {#if index % 3 === 0 && index < activity.weekStarts.length - 2}<span class="week">{shortDate(start)}</span>{/if}
              <span class="sr-only">Week of {shortDate(start)}</span>
            </th>
          {/each}
          <th class="total" scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.player.playerId)}
          <tr>
            <th class="stick name" scope="row">{row.player.displayName}</th>
            {#each row.weeks as count, index (index)}
              <td
                style:background={count ? tint(count) : undefined}
                title="{row.player.displayName}: {count} {count === 1 ? 'match' : 'matches'}, week of {shortDate(activity.weekStarts[index])}"
              >
                {count || ''}
              </td>
            {/each}
            <td class="total">{row.total}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="none">No players</p>
{/if}

<style>
  .activity {
    border-collapse: separate;
    border-spacing: 2px;
    margin: 0 -2px;
    white-space: nowrap;
  }

  th {
    font-weight: 400;
    padding: 0;
  }

  thead th {
    height: 22px;
    position: relative;
  }

  .week {
    bottom: 5px;
    color: var(--muted);
    font: 10px var(--mono);
    left: 1px;
    position: absolute;
  }

  .stick {
    background: var(--page);
    left: 0;
    position: sticky;
    z-index: 1;
  }

  .name {
    color: var(--ink-2);
    font-size: 12px;
    max-width: 120px;
    overflow: hidden;
    padding-right: 12px;
    text-align: left;
    text-overflow: ellipsis;
  }

  td {
    background: var(--cell);
    border-radius: 2px;
    font: 10.5px var(--mono);
    height: 22px;
    min-width: 26px;
    text-align: center;
    width: 26px;
  }

  .total {
    background: none;
    color: var(--ink-2);
    font: 12px var(--mono);
    padding-left: 10px;
    text-align: right;
    width: auto;
  }

  thead .total {
    color: var(--muted);
    font: 500 11px var(--sans);
  }
</style>
