<script lang="ts">
  import type { PairRecord, SquadPlayer } from '$lib/types';

  let {
    pairs,
    players,
    minimum = 3
  }: { pairs: PairRecord[]; players: Map<string, SquadPlayer>; minimum?: number } = $props();

  const shown = $derived(pairs.filter((pair) => pair.matches >= minimum));
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';
</script>

{#if shown.length}
  <table class="duos">
    <thead>
      <tr>
        <th class="left" scope="col">Pair</th>
        <th scope="col">Games</th>
        <th scope="col">Won</th>
        <th class="bar-col" scope="col"><span class="sr-only">Win rate</span></th>
        <th scope="col">Win</th>
      </tr>
    </thead>
    <tbody>
      {#each shown as pair (pair.a + pair.b)}
        <tr>
          <th class="left" scope="row">{name(pair.a)} <span class="amp">&amp;</span> {name(pair.b)}</th>
          <td>{pair.matches}</td>
          <td>{pair.wins}</td>
          <td class="bar-col" aria-hidden="true">
            <span class="track"><span class="fill" class:down={pair.winRate < 50} style:width="{pair.winRate}%"></span><span class="mid"></span></span>
          </td>
          <td>{pair.winRate.toFixed(0)}%</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p class="quiet">No pair has played {minimum} games together recently.</p>
{/if}
