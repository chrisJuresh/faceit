<script lang="ts">
  import { LEVEL_FLOORS, eloToNextLevel, levelVar } from '$lib/levels';
  import type { SquadPlayer } from '$lib/types';

  let { players }: { players: SquadPlayer[] } = $props();

  const ranked = $derived(players.filter((player) => player.elo > 0).sort((a, b) => b.elo - a.elo));

  // Span the levels the group occupies, starting at the lowest player's level.
  const lowLevel = $derived(Math.max(1, Math.min(...ranked.map((p) => p.level))));
  const min = $derived(LEVEL_FLOORS[lowLevel - 1]);
  const max = $derived(
    Math.max(
      LEVEL_FLOORS[Math.min(9, Math.max(...ranked.map((p) => p.level)))] ?? 0,
      ...ranked.map((p) => p.elo + 60),
      2100
    )
  );
  const bands = $derived(
    LEVEL_FLOORS.map((floor, index) => ({
      level: index + 1,
      from: Math.max(floor, min),
      to: Math.min(LEVEL_FLOORS[index + 1] ?? max, max)
    })).filter((band) => band.to - band.from > 0)
  );
  const x = (elo: number) => ((Math.min(Math.max(elo, min), max) - min) / (max - min)) * 100;
</script>

{#if ranked.length}
  <figure class="ladder">
    <div class="row scale" aria-hidden="true">
      <span></span>
      <span class="track">
        {#each bands as band (band.level)}
          <span class="band" style:left="{x(band.from)}%" style:width="{x(band.to) - x(band.from)}%" style:--level={levelVar(band.level)}>
            <span>{band.level}</span>
          </span>
        {/each}
      </span>
      <span class="value-head">ELO</span>
      <span class="value-head">To next</span>
    </div>
    <ol>
      {#each ranked as player (player.playerId)}
        {@const next = eloToNextLevel(player.elo)}
        <li class="row">
          <span class="who">{player.displayName}</span>
          <span class="track">
            {#each bands as band (band.level)}
              <span class="rule" style:left="{x(band.from)}%"></span>
            {/each}
            {#if next !== null}
              <span class="lead" style:left="{x(player.elo)}%" style:width="{x(player.elo + next) - x(player.elo)}%"></span>
            {/if}
            <span class="dot" style:left="{x(player.elo)}%" style:--level={levelVar(player.level)}></span>
          </span>
          <span class="value">{player.elo.toLocaleString('en-GB')}</span>
          <span class="next">{next === null ? '—' : next}</span>
        </li>
      {/each}
    </ol>
  </figure>
{:else}
  <p class="none">No ELO to show.</p>
{/if}

<style>
  .ladder {
    font-size: 12px;
    margin: 0;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    align-items: center;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(90px, 128px) minmax(0, 1fr) 44px 48px;
    height: 23px;
  }

  .scale {
    height: 26px;
  }

  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track {
    height: 100%;
    position: relative;
  }

  .band {
    border-top: 3px solid var(--level);
    bottom: 4px;
    color: var(--muted);
    position: absolute;
    text-align: center;
    top: 2px;
  }

  .band span {
    display: block;
    font-size: 11px;
    padding-top: 3px;
  }

  .rule {
    background: var(--rule);
    bottom: 0;
    position: absolute;
    top: 0;
    width: 1px;
  }

  .lead {
    border-top: 1px solid var(--rule-2);
    height: 0;
    position: absolute;
    top: 50%;
  }

  .dot {
    background: var(--level);
    border: 2px solid var(--page);
    border-radius: 50%;
    height: 12px;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
  }

  .value,
  .next,
  .value-head {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .next,
  .value-head {
    color: var(--muted);
  }

  .value-head {
    align-self: end;
    font-size: 11px;
    padding-bottom: 4px;
  }
</style>
