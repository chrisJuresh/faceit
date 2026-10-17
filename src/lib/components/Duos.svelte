<script lang="ts">
  import { fixed } from '$lib/format';
  import type { PairRecord, SquadPlayer } from '$lib/types';
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
          : y.winRate - x.winRate || y.matches - x.matches
      )
  );
  const half = $derived(Math.ceil(shown.length / 2));
  const columns = $derived(shown.length > 1 ? [shown.slice(0, half), shown.slice(half)] : [shown]);
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';
</script>

<div class="section-head">
  <h2>Duos</h2>
  <span class="meta">Same team, last {windowDays} days</span>
  <div class="controls">
    <div class="seg" role="group" aria-label="Order">
      <button type="button" aria-pressed={order === 'games'} onclick={() => (order = 'games')}>Most played</button>
      <button type="button" aria-pressed={order === 'rate'} onclick={() => (order = 'rate')}>Win %</button>
    </div>
    <span class="divider" aria-hidden="true"></span>
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
              <td class="l">{name(pair.a)}<span class="amp">+</span><wbr />{name(pair.b)}</td>
              <td>{pair.matches}</td>
              <td>{pair.wins}–{pair.matches - pair.wins}</td>
              <td>{fixed(pair.winRate)}</td>
              <td class="track"><WinTrack rate={pair.winRate} faded={pair.matches < FEW} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/each}
  </div>
{:else}
  <p class="none">No pair has played three matches together in the last {windowDays} days</p>
{/if}

<style>
  .columns {
    display: grid;
    gap: 0 48px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mini td {
    height: 30px;
  }

  .amp {
    color: var(--muted);
    margin: 0 6px;
  }

  .track {
    --track-width: 80px;
    padding-left: 14px;
    text-align: left;
    width: 96px;
  }

  @media (max-width: 860px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .columns .mini + .mini thead {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .mini td.l {
      white-space: normal;
    }

    .mini td {
      height: auto;
      padding-bottom: 5px;
      padding-top: 5px;
    }

    .track {
      --track-width: 48px;
      padding-left: 8px;
      width: 58px;
    }
  }
</style>
