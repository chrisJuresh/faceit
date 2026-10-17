<script lang="ts">
  import { fixed } from '$lib/format';
  import type { PairRecord, SquadPlayer } from '$lib/types';
  import Divider from './Divider.svelte';
  import WinTrack from './WinTrack.svelte';

  let {
    pairs,
    players,
    windowDays
  }: { pairs: PairRecord[]; players: Map<string, SquadPlayer>; windowDays: number } = $props();

  /** Pairs with fewer games than this are muted. */
  const FEW = 5;

  let order = $state<'games' | 'rate'>('games');
  let everyone = $state(false);

  const shown = $derived(
    pairs
      .filter((pair) => everyone || pair.matches >= 3)
      .sort((x, y) =>
        order === 'games'
          ? y.matches - x.matches || y.winRate - x.winRate
          : // Pairs with fewer than FEW games sit below every pair with more, so a 2–0 can't top the list.
            Number(y.matches >= FEW) - Number(x.matches >= FEW) || y.winRate - x.winRate || y.matches - x.matches
      )
  );
  const half = $derived(Math.ceil(shown.length / 2));
  const columns = $derived(shown.length > 1 ? [shown.slice(0, half), shown.slice(half)] : [shown]);
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';
</script>

<div class="section-head">
  <h2>Duos</h2>
  <span class="meta">Same team, last <span class="mono">{windowDays}</span> days</span>
  <div class="controls">
    <div class="seg" role="group" aria-label="Order">
      <button type="button" aria-pressed={order === 'games'} onclick={() => (order = 'games')}>Most played</button>
      <button type="button" aria-pressed={order === 'rate'} onclick={() => (order = 'rate')}>Win %</button>
    </div>
    <Divider />
    <div class="seg" role="group" aria-label="Pairs shown">
      <button type="button" aria-pressed={!everyone} onclick={() => (everyone = false)}>3+ matches</button>
      <button type="button" aria-pressed={everyone} onclick={() => (everyone = true)}>
        All<span class="count">{pairs.length}</span>
      </button>
    </div>
  </div>
</div>

{#if shown.length}
  <div class="columns">
    {#each columns as list, index (index)}
      <div class="scroll">
        <table class="mini">
          <thead>
            <tr>
              <th class="l" scope="col">Pair</th>
              <th scope="col">M</th>
              <th scope="col">W–L</th>
              <th scope="col">Win %</th>
              <th scope="col"><span class="sr-only">Win rate from 0 to 100, 50 marked</span></th>
            </tr>
          </thead>
          <tbody>
            {#each list as pair (pair.a + pair.b)}
              <tr class:low={pair.matches < FEW}>
                <th class="l" scope="row" title="{name(pair.a)} + {name(pair.b)}">
                  <span class="pair"><span class="who-name">{name(pair.a)}</span><span class="amp">+</span><span class="who-name"
                      >{name(pair.b)}</span
                    ></span
                  >
                </th>
                <td>{pair.matches}</td>
                <td>{pair.wins}–{pair.matches - pair.wins}</td>
                <td>{fixed(pair.winRate)}</td>
                <td class="track"><WinTrack rate={pair.winRate} faded={pair.matches < FEW} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  </div>
{:else}
  <p class="none">No duos</p>
{/if}

<style>
  .columns {
    display: grid;
    gap: 0 48px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* The Players table's row height, so the two lists read at the same density. */
  .mini th,
  .mini td {
    height: 32px;
  }

  .pair {
    align-items: baseline;
    display: inline-flex;
    max-width: 100%;
  }

  .who-name {
    max-width: 12em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .amp {
    color: var(--muted);
    flex: none;
    margin: 0 6px;
  }

  .track {
    padding-left: 10px;
    text-align: left;
    width: 88px;
  }

  @media (max-width: 860px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .columns .scroll + .scroll thead {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .who-name {
      max-width: 7em;
    }
  }
</style>
