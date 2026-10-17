<script lang="ts">
  import type { PairRecord, SquadPlayer } from '$lib/types';

  let {
    pairs,
    players,
    windowDays
  }: { pairs: PairRecord[]; players: Map<string, SquadPlayer>; windowDays: number } = $props();

  /** Pairs with fewer games than this are faded. */
  const FEW = 5;

  let order = $state<'games' | 'rate'>('games');
  let everyone = $state(false);

  const shown = $derived(
    pairs
      .filter((pair) => everyone || pair.matches >= 3)
      .sort((x, y) =>
        order === 'games'
          ? y.matches - x.matches || y.winRate - x.winRate
          : Number(y.matches >= FEW) - Number(x.matches >= FEW) || y.winRate - x.winRate || y.matches - x.matches
      )
  );
  const half = $derived(Math.ceil(shown.length / 2));
  const columns = $derived(shown.length > 8 ? [shown.slice(0, half), shown.slice(half)] : [shown]);
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';
</script>

<div class="section-head">
  <h2>Duos</h2>
  <span class="meta">Same team, last {windowDays} days</span>
</div>

<div class="controls">
  <div class="seg" role="group" aria-label="Order">
    <button type="button" aria-pressed={order === 'games'} onclick={() => (order = 'games')}>Most played</button>
    <button type="button" aria-pressed={order === 'rate'} onclick={() => (order = 'rate')}>Win %</button>
  </div>
  <div class="seg push" role="group" aria-label="Pairs shown">
    <button type="button" aria-pressed={!everyone} onclick={() => (everyone = false)}>3+ games</button>
    <button type="button" aria-pressed={everyone} onclick={() => (everyone = true)}>All<span class="count">{pairs.length}</span></button>
  </div>
</div>

{#if shown.length}
  <div class="columns" class:two={columns.length === 2}>
    {#each columns as list, index (index)}
      <table class="tbl duos">
        <thead>
          <tr>
            <th class="l" scope="col">Pair</th>
            <th scope="col">Games</th>
            <th scope="col">W–L</th>
            <th scope="col">Win %</th>
            <th class="track-col" scope="col"><span class="sr-only">Win rate from 0 to 100%, 50% marked</span></th>
          </tr>
        </thead>
        <tbody>
          {#each list as pair (pair.a + pair.b)}
            <tr class:low={pair.matches < FEW}>
              <th class="l" scope="row">{name(pair.a)} <span class="amp">+</span> {name(pair.b)}</th>
              <td>{pair.matches}</td>
              <td>{pair.wins}–{pair.matches - pair.wins}</td>
              <td>{pair.winRate.toFixed(0)}</td>
              <td class="track-col" aria-hidden="true">
                <span class="track">
                  <span class="mid"></span>
                  <span class="dot" class:up={pair.winRate >= 50} style:left="{pair.winRate}%"></span>
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/each}
  </div>
{:else}
  <p class="none">No pair has played three games together in the last {windowDays} days.</p>
{/if}

<style>
  .columns {
    display: grid;
    gap: 0 40px;
  }

  .columns.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .duos tbody th {
    font-weight: 500;
  }

  .amp {
    color: var(--muted);
    margin: 0 3px;
  }

  .track-col {
    width: 34%;
  }

  .track {
    display: block;
    height: 12px;
    margin: 0 6px;
    position: relative;
  }

  .track::before {
    background: var(--rule-2);
    content: '';
    height: 1px;
    left: 0;
    position: absolute;
    right: 0;
    top: 50%;
  }

  .mid {
    background: var(--ink-2);
    height: 12px;
    left: 50%;
    position: absolute;
    top: 0;
    width: 1px;
  }

  .dot {
    background: var(--loss);
    border: 2px solid var(--page);
    border-radius: 50%;
    height: 12px;
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    width: 12px;
  }

  .dot.up {
    background: var(--win);
  }

  .low .dot {
    opacity: 0.45;
  }

  @media (max-width: 900px) {
    .columns.two {
      grid-template-columns: minmax(0, 1fr);
    }

    .columns.two .duos + .duos thead {
      display: none;
    }
  }
</style>
