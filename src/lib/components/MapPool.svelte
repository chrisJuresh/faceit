<script lang="ts">
  import type { SquadPlayer } from '$lib/types';

  let {
    players,
    groupMaps
  }: { players: SquadPlayer[]; groupMaps: Array<{ map: string; matches: number; wins: number }> } =
    $props();

  const MIN_SAMPLE = 5;

  // Maps ordered by how much the group has played them (lifetime), dropping one-offs.
  const maps = $derived.by(() => {
    const totals = new Map<string, number>();
    for (const player of players) {
      for (const map of player.maps) totals.set(map.map, (totals.get(map.map) ?? 0) + map.matches);
    }
    return [...totals.entries()]
      .filter(([, total]) => total >= MIN_SAMPLE * 2)
      .sort((a, b) => b[1] - a[1])
      .map(([map]) => map);
  });
  const rows = $derived(players.filter((player) => player.maps.length));
  const together = $derived(new Map(groupMaps.map((record) => [record.map, record])));

  function cell(player: SquadPlayer, map: string) {
    return player.maps.find((entry) => entry.map === map) ?? null;
  }

  /** Diverging around 50%: strength 0 at 50%, 1 at 25% or 75% and beyond. */
  const strength = (winRate: number) => Math.min(1, Math.abs(winRate - 50) / 25);
</script>

<div class="scroll">
  <table class="heat">
    <thead>
      <tr>
        <th class="left" scope="col">Player</th>
        {#each maps as map (map)}<th scope="col">{map}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as player (player.playerId)}
        <tr>
          <th class="left" scope="row">{player.displayName}</th>
          {#each maps as map (map)}
            {@const record = cell(player, map)}
            {#if record && record.matches >= MIN_SAMPLE}
              <td
                class:up={record.winRate >= 50}
                class:down={record.winRate < 50}
                style:--strength={strength(record.winRate)}
                title="{player.displayName} on {map}: {record.wins} wins in {record.matches} ({record.winRate}%)"
              >
                <span class="rate">{record.winRate}</span><span class="n">{record.matches}</span>
              </td>
            {:else if record}
              <td class="few" title="{player.displayName} on {map}: {record.wins} wins in {record.matches}">
                <span class="n">{record.matches}</span>
              </td>
            {:else}
              <td class="none"></td>
            {/if}
          {/each}
        </tr>
      {/each}
    </tbody>
    {#if groupMaps.length}
      <tfoot>
        <tr>
          <th class="left" scope="row">Together</th>
          {#each maps as map (map)}
            {@const record = together.get(map)}
            {#if record}
              {@const rate = Math.round((record.wins / record.matches) * 100)}
              <td
                class:few={record.matches < MIN_SAMPLE}
                class:up={record.matches >= MIN_SAMPLE && rate >= 50}
                class:down={record.matches >= MIN_SAMPLE && rate < 50}
                style:--strength={strength(rate)}
                title="Together on {map}: {record.wins} wins in {record.matches}"
              >
                {#if record.matches >= MIN_SAMPLE}<span class="rate">{rate}</span>{/if}<span class="n">{record.matches}</span>
              </td>
            {:else}
              <td class="none"></td>
            {/if}
          {/each}
        </tr>
      </tfoot>
    {/if}
  </table>
</div>
