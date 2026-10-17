<script lang="ts">
  import { shortDate } from '$lib/format';
  import type { SquadOverview, SquadPlayer } from '$lib/types';

  let {
    activity,
    players
  }: { activity: SquadOverview['activity']; players: Map<string, SquadPlayer> } = $props();

  const rows = $derived(
    activity.rows
      .map((row) => ({ ...row, player: players.get(row.playerId), total: row.counts.reduce((a, b) => a + b, 0) }))
      .filter((row) => row.player && row.total > 0)
      .sort((a, b) => b.total - a.total)
  );
  const peak = $derived(Math.max(1, ...rows.flatMap((row) => row.counts)));
</script>

<div class="scroll">
  <table class="activity">
    <thead>
      <tr>
        <th class="left" scope="col">Player</th>
        {#each activity.weekStarts as start, index (start)}
          <th scope="col" title="Week of {shortDate(start)}">
            {#if index % 4 === 0 || index === activity.weekStarts.length - 1}{shortDate(start)}{/if}
          </th>
        {/each}
        <th scope="col">Total</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.playerId)}
        <tr>
          <th class="left" scope="row">{row.player?.displayName}</th>
          {#each row.counts as count, index (index)}
            <td
              class="cell"
              style:--level={count ? 0.15 + 0.85 * (count / peak) : 0}
              title="{row.player?.displayName}: {count} {count === 1 ? 'match' : 'matches'}, week of {shortDate(activity.weekStarts[index])}"
            >
              <span class="sr-only">{count}</span>
            </td>
          {/each}
          <td class="total">{row.total}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
